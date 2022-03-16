// Copyright (c) 2022, NVIDIA CORPORATION.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Float32Buffer, MemoryView} from '@rapidsai/cuda';
import {addon as CUDF, DataFrame, Float32, Int32, scope, Series} from '@rapidsai/cudf';
import {DedupedEdgesGraph} from '@rapidsai/cugraph';
import {DeviceBuffer} from '@rapidsai/rmm';
import {performance} from 'perf_hooks';

import * as Ix from '../ix';
import {getTextureSize, TextureFormats} from '../types';
import {HostBuffers, LayoutParams, ShapedEdges, ShapedIcons, ShapedNodes} from '../types';

export function layout(dataSource: AsyncIterable<{
                         kind: 'replace' | 'append',
                         nodes: Uint8Array,
                         edges: Uint8Array,
                         icons: Uint8Array,
                       }>,
                       layoutParams: AsyncIterable<LayoutParams>) {
  const params = Ix.ai.whileDo(Ix.ai.of(0), () => new Promise((r) => setTimeout(r, 0, true)))
                   .pipe(Ix.ai.ops.withLatestFrom(layoutParams))
                   .pipe(Ix.ai.ops.map(([, params]) => params));

  const graphs = Ix.ai.as(dataSource).pipe(Ix.ai.ops.map((update) => {
    const nodes = DataFrame.fromArrow<ShapedNodes>(update.nodes);
    const edges = DataFrame.fromArrow<ShapedEdges>(update.edges);
    const icons = DataFrame.fromArrow<ShapedIcons>(update.icons);
    return {
      // nodes,
      // edges,
      icons,
      kind: update.kind,
      hostBuffers: new DataFrameHostBuffers(nodes, edges, icons),
      graph: new (DedupedEdgesGraph as any)(
               nodes.select(['id']).assign({node: nodes.get('id')}),
               edges.select(['id', 'src', 'dst']).assign({
                 weight: Series.sequence({type: new Float32, size: edges.numRows, init: 1, step: 0})
               }),
               {directed: true}) as DedupedEdgesGraph<Int32>
    };
  }));

  const paramsAndGraphs = params  //
                            .pipe(Ix.ai.ops.withLatestFrom(graphs))
                            .pipe(Ix.ai.ops.map(([params, data]) => ({params, data})));

  const layoutScanSeed = {
    time: 0,
    bbox: [NaN, NaN, NaN, NaN],
    hostBuffers: new HostBuffers(),
    positions: undefined as Float32Buffer,
    // nodes: undefined as DataFrame<ShapedNodes>,
    // edges: undefined as DataFrame<ShapedEdges>,
    icons: undefined as DataFrame<ShapedIcons>,
    graph: undefined as DedupedEdgesGraph<Int32>,
  };

  return paramsAndGraphs  //
    .pipe(Ix.ai.ops.scan({seed: layoutScanSeed, callback: layoutScanSelector}))
    .pipe(Ix.ai.ops.map(({bbox, hostBuffers}) => ({bbox, ...hostBuffers})));
}

interface LayoutMemo {
  time: number;
  kind: 'replace'|'append';
  positions: Float32Buffer;
  hostBuffers: HostBuffers;
  icons: DataFrame<ShapedIcons>;
  graph: DedupedEdgesGraph<Int32>;
  bbox: [number, number, number, number];
}

interface LayoutEvent {
  data: LayoutMemo;
  params: LayoutParams;
}

function layoutScanSelector(memo: LayoutMemo, {params, data}: LayoutEvent) {
  const n         = data.graph.numNodes;
  const positions = scope(() => {
    if (memo.positions && (memo.positions.length / 2) !== n) {
      const m        = memo.positions.length / 2;
      memo.positions = (new Float32Buffer(new DeviceBuffer(n * 2 * 4))
                          .fill(0)
                          .copyFrom(memo.positions, 0, 0, Math.min(m, n))
                          .copyFrom(memo.positions, m, n, n * 2));
    }
    // Compute positions from the previous positions
    let pos = Series.new(
      params.active ? data.graph.forceAtlas2({...params, positions: memo.positions})
                    : memo.positions ?? new Float32Buffer(new DeviceBuffer(n * 2 * 4)).fill(0));
    // Fill NaNs produced by fa2 with zeros (NaNs break fa2)
    if (pos.isNaN().any()) {
      pos = pos.replaceNaNs(0);
      if (pos.sum() === 0) {
        pos = Series.prototype.concat.call(
          // xs
          Series.sequence({type: new Float32, size: n}),
          // ys
          Series.sequence({type: new Float32, size: n}));
      }
    }
    return pos.data;
  }, [data.graph]);

  const x = Series.new(positions.subarray(0, n * 1));
  const y = Series.new(positions.subarray(n, n * 2));

  // Copy the x/y positions to host
  data.hostBuffers.node.xPosition =
    alignedCopyDToH(x.data, memo.hostBuffers.node.xPosition, 'RGBA32F');
  data.hostBuffers.node.yPosition =
    alignedCopyDToH(y.data, memo.hostBuffers.node.yPosition, 'RGBA32F');

  if (data.kind === 'replace') { memo.icons = undefined; }

  // Update icon ages
  memo.icons = scope(() => {
    let {icons} = memo;
    if (icons && params.active && memo.time > 0) {
      const deltaT = new CUDF.Scalar({type: new Float32, value: performance.now() - memo.time});
      icons        = icons.assign({age: icons.get('age').add(deltaT) as Series<Float32>});
    }
    return combineIcons(icons, data.icons);
  }, [memo.icons, data.icons]);

  // Prune icons that are too young or too old
  scope(() => {
    let {icons} = memo;
    const ages  = icons.get('age');
    const mask  = ages.ge(0).logicalAnd(ages.le(3500));
    if (!mask.all()) { icons = icons.filter(mask); }

    data.hostBuffers.icon.changed ||= icons.numRows !== memo.icons.numRows;

    if (data.hostBuffers.icon.changed) {
      // Copy the icon buffers to host
      const table                = icons.toArrow();
      data.hostBuffers.icon.id   = table.getColumn('id').toArray();
      data.hostBuffers.icon.age  = table.getColumn('age').toArray();
      data.hostBuffers.icon.icon = table.getColumn('icon').toArray();
      data.hostBuffers.icon.edge = table.getColumn('edge').toArray();
    }
  }, [memo.icons]);

  // Compute the positions minimum bounding box [xMin, xMax, yMin, yMax]
  memo.bbox = [...x.minmax(), ...y.minmax()] as [number, number, number, number];

  memo.time      = performance.now();
  memo.positions = positions;

  Object.assign(memo.hostBuffers.node, data.hostBuffers.node);
  Object.assign(memo.hostBuffers.edge, data.hostBuffers.edge);
  Object.assign(memo.hostBuffers.icon, data.hostBuffers.icon);

  data.hostBuffers.node.changed = false;
  data.hostBuffers.edge.changed = false;
  data.hostBuffers.icon.changed = false;

  delete data.kind;
  delete data.icons;

  // Yield the host buffers to the render process
  return memo;
}

function combineIcons(curIcons?: DataFrame<ShapedIcons>, newIcons?: DataFrame<ShapedIcons>) {
  if (newIcons && newIcons.numRows > 0) {
    if (curIcons && curIcons.numRows > 0) {
      const icons = curIcons.join({
        how: 'outer',
        on: ['id'],
        lsuffix: '_x',
        rsuffix: '_y',
        other: newIcons,
      });
      return icons.drop(['age_x', 'age_y', 'edge_x', 'edge_y', 'icon_x', 'icon_y']).assign({
        age: icons.get('age_x').replaceNulls(icons.get('age_y')),
        edge: icons.get('edge_x').replaceNulls(icons.get('edge_y')),
        icon: icons.get('icon_x').replaceNulls(icons.get('icon_y')),
      })
    }
    return newIcons;
  }
  return curIcons;
}

class DataFrameHostBuffers extends HostBuffers {
  constructor(nodes: DataFrame<ShapedNodes>,
              edges: DataFrame<ShapedEdges>,
              icons: DataFrame<ShapedIcons>) {
    super({
      edge: {
        changed: true,
        id: copyDToH(edges.get('id').data),
        edge: copyDToH(edges.get('edge').data),
        color: copyDToH(edges.get('color').data),
        bundle: copyDToH(edges.get('bundle').data),
      },
      icon: {
        changed: true,
        id: copyDToH(icons.get('id').data),
        age: copyDToH(icons.get('age').data),
        icon: copyDToH(icons.get('icon').data),
        edge: copyDToH(icons.get('edge').data),
      },
      node: {
        changed: true,
        xPosition: undefined,
        yPosition: undefined,
        id: copyDToH(nodes.get('id').data),
        color: copyDToH(nodes.get('color').data),
        radius: copyDToH(nodes.get('size').data),
      },
    });
  }
}

function copyDToH(src: MemoryView, dst?: any) {
  src.copyInto(dst = ((ary) => {
                 if (!ary || ary.length < src.length) { return new src.TypedArray(src.length); }
                 return ary.subarray(0, src.length);
               })(dst));
  return dst;
}

function alignedCopyDToH(src: MemoryView, dst: any, format: TextureFormats) {
  src.copyInto(dst = ((ary) => {
                 const {length} = getTextureSize(format, src.byteLength, src.BYTES_PER_ELEMENT);
                 if (!ary || ary.length < length) { return new src.TypedArray(length); }
                 return ary.subarray(0, length);
               })(dst));
  return dst;
}
