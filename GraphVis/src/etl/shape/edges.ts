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

import {DataFrame, Int32, scope, Series, Uint32, Uint64} from '@rapidsai/cudf';
import {DedupedEdgesGraph} from '@rapidsai/cugraph';
import {ShapedEdges, ShapedNodes} from '../../types';

export function makeEdges(graph: DedupedEdgesGraph<Int32>, nodes: DataFrame<ShapedNodes>) {
  return graph.edgeIds.select(['id', 'src', 'dst']).assign({
    edge: graph.edgeIds.select(['src', 'dst']).interleaveColumns().view(new Uint64),
    color: edgeColors(nodes.select(['id', 'color']), graph.edgeIds.select(['id', 'src', 'dst'])),
    bundle: new DataFrame({
              eindex: Series.sequence({size: graph.numEdges, init: 0, step: 0}),
              bcount: Series.sequence({size: graph.numEdges, init: 1, step: 0}),
            })
              .interleaveColumns()
              .view(new Uint64),
  }) as DataFrame<ShapedEdges>;
}

function edgeColors(nodes: DataFrame<{id: Int32, color: Uint32}>,
                    edges: DataFrame<{id: Int32, src: Int32, dst: Int32}>) {
  // return new DataFrame({
  //   src: defaultColorPalette.gather(Series.sequence({ size: edges.numRows, init: 8, step: 0 })),
  //   dst: defaultColorPalette.gather(Series.sequence({ size: edges.numRows, init: 8, step: 0 })),
  // }).interleaveColumns().view(new Uint64);
  return scope(() => {
    const src = edges.select(['id', 'src'])
                  .join({on: ['src'], other: nodes.rename({id: 'src'})})
                  .sortValues({id: {ascending: true}})
                  .get('color');
    const dst = edges.select(['id', 'dst'])
                  .join({on: ['dst'], other: nodes.rename({id: 'dst'})})
                  .sortValues({id: {ascending: true}})
                  .get('color');
    return new DataFrame({src, dst}).interleaveColumns().view(new Uint64);
  }, [nodes, edges]);
}
