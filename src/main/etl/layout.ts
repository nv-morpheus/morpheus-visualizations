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

import { performance } from 'perf_hooks';

import { AsyncIterable as AsyncIterableX } from 'ix/Ix.node';

import { Graph } from '@rapidsai/cugraph';
import { MemoryView, Float32Buffer } from '@rapidsai/cuda';
import { addon as CUDF, DataFrame, Series, Float32, Int32 } from '@rapidsai/cudf';
import { HostBuffers, LayoutParams, ShapedNodes, ShapedEdges, ShapedIcons, TextureFormats } from '../../types';

export function layout(
  dataSource: AsyncIterable<{
    graph: Graph<Int32>,
    nodes: DataFrame<ShapedNodes>,
    edges: DataFrame<ShapedEdges>,
    icons: DataFrame<ShapedIcons>,
  }>,
  inputSource: AsyncIterable<LayoutParams> = AsyncIterableX.of(new LayoutParams())
) {

  const inputs = AsyncIterableX
    // while(true)
    .whileDo(AsyncIterableX.of(0), () => new Promise((r) => setTimeout(r, 0, true)))
    // yield values when either `while(true)` or `inputSource` emits
    .withLatestFrom(inputSource)
    // yield latest inputs value
    .map(([, inputs]) => inputs);

  // Copy each new dataSource value to host buffers
  const graphAndHostBuffers = AsyncIterableX.as(dataSource)
    .map(({ nodes, edges, icons, ...rest }) => ({
      ...rest,
      icons,
      hostBuffers: new DataFrameHostBuffers(nodes, edges, icons)
    }));

  const inputsAndDataWhileActive = inputs
    // Select the latest value from `dataSource` in the background,
    // but only yield it the next time `inputs` yields a value
    .withLatestFrom(graphAndHostBuffers)
    .map(([inputs, data]) => ({ inputs, data }))
    // Only yield values when `inputs.active` is true
    .filter(({ inputs: { active } }) => active);

  const fa2Loop = inputsAndDataWhileActive.scan({
    seed: {
      time: 0,
      icons: undefined,
      positions: undefined,
      bbox: [NaN, NaN, NaN, NaN],
      hostBuffers: new HostBuffers(),
    } as {
      time: number,
      positions: Float32Buffer,
      hostBuffers: HostBuffers,
      icons: DataFrame<ShapedIcons>,
      bbox: [number, number, number, number],
    },
    callback(memo, { inputs, data }) {
      // const startTime = performance.now();

      // Compute positions from the previous positions
      let positions = data.graph.forceAtlas2({
        ...inputs, positions: memo.positions
      });

      // Fill NaNs produced by fa2 with zeros (NaNs break fa2)
      let pos = Series.new(positions);
      if (pos.isNaN().any()) {
        positions = pos.replaceNaNs(0).data;
        pos = Series.new(positions);
        if (pos.sum() === 0) {
          const args = { type: new Float32, size: data.graph.numNodes };
          positions =
            // xs
            Series.sequence(args).concat<Float32>(
              // ys
              Series.sequence(args)).data;
        }
      }

      const n = data.graph.numNodes;
      const x = Series.new(positions.subarray(0, n * 1));
      const y = Series.new(positions.subarray(n, n * 2));

      // Copy the x/y positions to host
      data.hostBuffers.node.xPosition = alignedCopyDToH(x.data, memo.hostBuffers.node.xPosition, 'RGBA32F');
      data.hostBuffers.node.yPosition = alignedCopyDToH(y.data, memo.hostBuffers.node.yPosition, 'RGBA32F');

      // Update icon ages
      let icons = memo.icons;
      if (icons) {
        if (memo.time > 0) {
          const deltaT = new CUDF.Scalar({ type: new Float32, value: 16 });
          icons = icons.assign({ age: icons.get('age').add(deltaT) as Series<Float32> });
          const mask = icons.get('age').le(5000);
          if (!mask.all()) {
            icons = icons.filter(mask);
            data.hostBuffers.icon.changed = true;
          }
        }
      }

      icons = concatIcons(icons, data.icons);

      // Copy the icon buffers to host
      data.hostBuffers.icon.id = copyDToH(icons.get('id').data, memo.hostBuffers.icon.id);
      data.hostBuffers.icon.age = copyDToH(icons.get('age').data, memo.hostBuffers.icon.age);
      if (data.hostBuffers.icon.changed) {
        data.hostBuffers.icon.icon = copyDToH(icons.get('icon').data, memo.hostBuffers.icon.icon);
        data.hostBuffers.icon.edge = copyDToH(icons.get('edge').data, memo.hostBuffers.icon.edge);
      }

      // Compute the positions minimum bounding box [xMin, xMax, yMin, yMax]
      const bbox = [...x.minmax(), ...y.minmax()] as [number, number, number, number];

      memo.bbox = bbox;
      memo.icons = icons;
      memo.positions = positions;
      memo.time += 16;
      // memo.time = performance.now();
      // memo.time += (performance.now() - startTime);
      Object.assign(memo.hostBuffers.node, data.hostBuffers.node);
      Object.assign(memo.hostBuffers.edge, data.hostBuffers.edge);
      Object.assign(memo.hostBuffers.icon, data.hostBuffers.icon);
      data.hostBuffers.node.changed = false;
      data.hostBuffers.edge.changed = false;
      data.hostBuffers.icon.changed = false;

      delete data.icons;

      // Yield the host buffers to the render process
      return memo;
    }
  });

  return fa2Loop.map(({ bbox, hostBuffers }) => ({ bbox, ...hostBuffers }));
}

function concatIcons(curIcons?: DataFrame<ShapedIcons>, newIcons?: DataFrame<ShapedIcons>) {
  if (newIcons) {
    if (curIcons) {
      const icons = curIcons.concat(newIcons);
      return icons.assign({
        id: Series.sequence({ size: icons.numRows }),
      });
    }
    return newIcons;
  }
  return curIcons;
}

class DataFrameHostBuffers extends HostBuffers {
  constructor(
    nodes?: DataFrame<ShapedNodes>,
    edges?: DataFrame<ShapedEdges>,
    icons?: DataFrame<ShapedIcons>
  ) {
    super({
      edge: {
        changed: true,
        id: copyDToH(edges?.get('id')?.data),
        edge: copyDToH(edges?.get('edge')?.data),
        color: copyDToH(edges?.get('color')?.data),
        bundle: copyDToH(edges?.get('bundle')?.data),
      },
      icon: {
        changed: true,
        id: copyDToH(icons?.get('id')?.data),
        age: copyDToH(icons?.get('age')?.data),
        icon: copyDToH(icons?.get('icon')?.data),
        edge: copyDToH(icons?.get('edge')?.data),
      },
      node: {
        changed: true,
        xPosition: undefined,
        yPosition: undefined,
        id: copyDToH(nodes?.get('id')?.data),
        color: copyDToH(nodes?.get('color')?.data),
        radius: copyDToH(nodes?.get('size')?.data),
      },
    });
  }
}

import { getTextureSize } from '../../types';

function copyDToH(src: MemoryView, dst?: any) {
  src.copyInto(dst = ((ary) => {
    if (!ary || ary.length < src.length) {
      return new src.TypedArray(src.length);
    }
    return ary.subarray(0, src.length);
  })(dst));
  return dst;
}

function alignedCopyDToH(src: MemoryView, dst: any, format: TextureFormats) {
  src.copyInto(dst = ((ary) => {
    const { length } = getTextureSize(format, src.byteLength, src.BYTES_PER_ELEMENT);
    if (!ary || ary.length < length) {
      return new src.TypedArray(length);
    }
    return ary.subarray(0, length);
  })(dst));
  return dst;
}
