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

import {Int32, scope, Series, Uint8} from '@rapidsai/cudf';
import {DedupedEdgesGraph, Graph} from '@rapidsai/cugraph';

import {defaultColorPalette} from './colors';

export function makeNodes(graph: DedupedEdgesGraph<Int32>) {
  return graph.nodeIds.assign({
    size: nodeSizes(graph),
    color: nodeColors(graph),
  });
}

function nodeSizes(graph: Graph<Int32>) {
  return scope(() => {return graph.degree().get('degree').scale().mul(254).add(1).cast(new Uint8)},
               [graph]);
}

function nodeColors(graph: DedupedEdgesGraph<Int32>, palette = defaultColorPalette) {
  return palette.gather(Series.sequence({size: graph.numNodes, init: 8, step: 0}));
  // return scope(() => {
  //   const num_clusters = Math.min(graph.numNodes - 1, palette.length);
  //   const codes = scope(() => {
  //     return graph.computeClusters({ type: 'balanced_cut', num_clusters }).get('cluster');
  //   }, [graph]);

  //   return Array.from({
  //     length: Math.ceil(codes.max() / (num_clusters - 1)) // - 1
  //   }).map(() => palette)
  //     .reduce((p0, p1) => p0.concat<Uint32>(p1), palette)
  //     .gather(codes);
  // }, [graph]);
}
