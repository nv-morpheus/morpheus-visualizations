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
import {maxIconAge} from '../types';
import {fromArrow} from '../utils';
import {ShapedUpdate} from './types';

export function withLayoutLoop(layoutParams: AsyncIterable<LayoutParams>) {
  return function layoutLoop(dataSource: AsyncIterable<ShapedUpdate>) {
    const params = Ix.ai.interval(16)
                     .pipe(Ix.ai.ops.withLatestFrom(
                       Ix.ai
                         .from(layoutParams)  //
                         .pipe(Ix.ai.ops.startWith(new LayoutParams({active: true})))))
                     .pipe(Ix.ai.ops.map(([, params]) => params));

    const graphs = Ix.ai.as(dataSource).pipe(Ix.ai.ops.map(({kind, index, dueTime, ...update}) => {
      const nodes = fromArrow<ShapedNodes>(update.nodes);
      const edges = fromArrow<ShapedEdges>(update.edges);
      const icons = fromArrow<ShapedIcons>(update.icons);
      return {
        // nodes,
        // edges,
        kind,
        index,
        curTime: 0,
        dueTime,
        icons,
        hostBuffers: new DataFrameHostBuffers(nodes, edges, icons),
        graph:
          new (DedupedEdgesGraph as any)(
            nodes.select(['id']).assign({node: nodes.get('id')}),
            edges.select(['id', 'src', 'dst']).assign({
              weight: Series.sequence({type: new Float32, size: edges.numRows, init: 1, step: 0})
            }),
            {directed: true}) as DedupedEdgesGraph<Int32>
      };
    }));

    const paramsAndGraphs =
      params  //
        .pipe(Ix.ai.ops.withLatestFrom(graphs))
        .pipe(Ix.ai.ops.map(([params, data]) => ({params, data, now: 0, deltaT: 0})));

    const layoutScanSeed: LayoutMemo = {
      index: 0,
      curTime: 0,
      dueTime: 0,
      kind: 'replace',
      bbox: [NaN, NaN, NaN, NaN],
      hostBuffers: new HostBuffers(),
      positions: undefined as Float32Buffer,
      icons: undefined as DataFrame<ShapedIcons>,
      graph: undefined as DedupedEdgesGraph<Int32>,
    };

    return paramsAndGraphs
      .pipe(Ix.ai.ops.scan({
        seed: {now: 0, data: null, params: null} as LayoutEvent,
        callback(memo, {data, params}) {
          const now    = performance.now();
          const deltaT = memo.now === 0 ? 0 : now - memo.now;
          memo.now     = now;
          memo.data    = data;
          memo.deltaT  = deltaT;
          memo.params  = params;
          return memo;
        },
      }))
      .pipe(Ix.ai.ops.filter(({params}) => params.active))
      .pipe(Ix.ai.ops.scan({seed: layoutScanSeed, callback: layoutScanSelector}))
      .pipe(
        Ix.ai.ops.map(({kind, bbox, index, hostBuffers}) => ({kind, bbox, index, ...hostBuffers})));
  }
}

interface LayoutData {
  index: number;
  curTime: number;
  dueTime: number;
  kind: 'replace'|'append';
  icons: DataFrame<ShapedIcons>;
  graph: DedupedEdgesGraph<Int32>;
  hostBuffers: HostBuffers;
}

interface LayoutMemo extends LayoutData {
  positions: Float32Buffer;
  bbox: [number, number, number, number];
}

interface LayoutEvent {
  now: number;
  deltaT: number;
  data: LayoutData;
  params: LayoutParams;
}

function layoutScanSelector(memo: LayoutMemo, {data, params, deltaT}: LayoutEvent) {
  // Invalidate scan state when data changes
  if (memo.dueTime !== data.dueTime) { memo.curTime = 0; }
  if (data.kind === 'replace') { memo.icons = undefined; }
  // TODO -- optimization?
  // if (memo.curTime > (data.dueTime + maxIconAge)) {  //
  //   memo.icons = undefined;
  // }

  // Update icon ages
  memo.icons = incrementIconAges(deltaT, params, memo);
  memo.icons = combineIcons(memo.icons, data.icons);
  // Filter the icons down to the subset we want to render
  data.hostBuffers = selectVisibleIcons(data, memo);

  data.kind  = undefined;
  data.icons = undefined;

  // Compute the new point positions
  memo.positions = runLayoutTick(memo, data, params);

  const n = data.graph.numNodes;
  const x = Series.new(memo.positions.subarray(0, n * 1));
  const y = Series.new(memo.positions.subarray(n, n * 2));

  // Copy the x/y positions to host
  data.hostBuffers.node.xPosition =
    alignedCopyDToH(x.data, memo.hostBuffers.node.xPosition, 'RGBA32F');
  data.hostBuffers.node.yPosition =
    alignedCopyDToH(y.data, memo.hostBuffers.node.yPosition, 'RGBA32F');

  // Compute the positions minimum bounding box [xMin, xMax, yMin, yMax]
  memo.bbox  = [...x.minmax(), ...y.minmax()] as [number, number, number, number];
  memo.index = data.index;
  memo.curTime += deltaT;
  memo.dueTime = data.dueTime;

  Object.assign(memo.hostBuffers.node, data.hostBuffers.node);
  Object.assign(memo.hostBuffers.edge, data.hostBuffers.edge);
  Object.assign(memo.hostBuffers.icon, data.hostBuffers.icon);

  data.hostBuffers.node.changed = false;
  data.hostBuffers.edge.changed = false;
  data.hostBuffers.icon.changed = false;

  // Yield the host buffers to the render process
  return memo;
}

function incrementIconAges(deltaT: number, {active}: LayoutParams, {icons}: LayoutData) {
  if (icons && active && deltaT > 0) {
    // Update icon ages
    const ages   = icons.get('age');
    const scalar = new CUDF.Scalar({type: new Float32, value: deltaT});
    icons        = icons.assign({age: ages.add(scalar)});
  }
  return icons;
}

function combineIcons(curIcons?: DataFrame<ShapedIcons>, newIcons?: DataFrame<ShapedIcons>) {
  if (newIcons && newIcons.numRows > 0) {
    if (curIcons && curIcons.numRows > 0) {
      return scope(() => {
        const icons = curIcons.join({
          how: 'outer',
          on: ['id'],
          lsuffix: '_x',
          rsuffix: '_y',
          other: newIcons,
        });
        return icons
          .drop(['age_x', 'age_y', 'edge_x', 'edge_y', 'icon_x', 'icon_y', 'data_x', 'data_y'])
          .assign({
            age: icons.get('age_x').replaceNulls(icons.get('age_y')),
            edge: icons.get('edge_x').replaceNulls(icons.get('edge_y')),
            icon: icons.get('icon_x').replaceNulls(icons.get('icon_y')),
            data: icons.get('data_x').replaceNulls(icons.get('data_y')),
          });
      }, [curIcons, newIcons]);
    }
    return newIcons;
  }
  return curIcons;
}

function selectVisibleIcons({hostBuffers}: LayoutData, {icons}: LayoutData) {
  if (!icons) {
    hostBuffers.icon.changed ||= hostBuffers.icon.id.length !== 0;
    hostBuffers.icon.id      = new Int32Array(0);
    hostBuffers.icon.age     = new Float32Array(0);
    hostBuffers.icon.icon    = new Int32Array(0);
    hostBuffers.icon.edge    = new Int32Array(0);
  } else {
    // Filter the icon lists down to the subset we want to render
    scope(() => {
      // Prune icons that are too young or too old
      const pruned = pruneIconsByAge(icons);
      // Set the changed flag if we pruned any icons due to their age
      hostBuffers.icon.changed ||= pruned.numRows !== icons.numRows;
      // Copy the pruned icon buffers to the host for rendering
      if (hostBuffers.icon.changed) {
        hostBuffers.icon.id   = pruned.get('id').data.toArray();
        hostBuffers.icon.age  = pruned.get('age').data.toArray();
        hostBuffers.icon.icon = pruned.get('icon').data.toArray();
        hostBuffers.icon.edge = pruned.get('edge').data.toArray();
      }
    }, [icons]);
  }
  return hostBuffers;
}

function pruneIconsByAge(icons: DataFrame<ShapedIcons>) {
  return scope(() => {
    const ages  = icons.get('age');
    const lower = ages.ge(minIconAgeScalar);
    const upper = ages.le(maxIconAgeScalar);
    const bools = lower.logicalAnd(upper);
    return bools.all() ? icons : icons.filter(bools);
  }, [icons]);
}

function runLayoutTick({positions}: LayoutMemo, {graph}: LayoutData, params: LayoutParams) {
  const n = graph.numNodes;
  if (positions && (positions.length / 2) !== n) {
    const m   = positions.length / 2;
    positions = (new Float32Buffer(new DeviceBuffer(n * 2 * 4))
                   .fill(0)
                   .copyFrom(positions, 0, 0, Math.min(m, n))
                   .copyFrom(positions, m, n, n * 2));
  }
  // Compute positions from the previous positions
  let pos =
    Series.new(params.active ? graph.forceAtlas2({...params, positions})
                             : positions ?? new Float32Buffer(new DeviceBuffer(n * 2 * 4)).fill(0));
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
                 if (!ary || ary.buffer.byteLength < src.byteLength) {
                   return new src.TypedArray(src.length);
                 }
                 return new src.TypedArray(ary.buffer, 0, src.length);
               })(dst));
  return dst;
}

function alignedCopyDToH(src: MemoryView, dst: any, format: TextureFormats) {
  src.copyInto(dst = ((ary) => {
                 const BPE      = src.BYTES_PER_ELEMENT;
                 const {length} = getTextureSize(format, src.byteLength, BPE);
                 if (!ary || ary.buffer.byteLength < length * BPE) {
                   return new src.TypedArray(length);
                 }
                 return new src.TypedArray(ary.buffer, 0, length);
               })(dst));
  return dst;
}

const minIconAgeScalar = new CUDF.Scalar({type: new Float32, value: 0});
const maxIconAgeScalar = new CUDF.Scalar({type: new Float32, value: maxIconAge});
