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

import {DataFrame} from '@rapidsai/cudf';

import {PreshapedEdges} from '../types';

import {makeEdges} from './shape/edges';
import {makeGraph} from './shape/graph';
import {makeIcons} from './shape/icons';
import {makeNodes} from './shape/nodes';

export function shape(curEdges: DataFrame<PreshapedEdges>,
                      newEdges: DataFrame<PreshapedEdges> = curEdges) {
  const graph = makeGraph(newEdges);
  const nodes = makeNodes(graph);
  const edges = makeEdges(graph, nodes);
  const icons =
    makeIcons(newEdges.get('src'),
              newEdges.get('dst'),
              newEdges.get('lvl'),
              curEdges === newEdges ? graph.edgeIds.select(['id', 'src', 'dst']) : undefined);
  return {
    oldEdges: newEdges,
    nodes,
    edges,
    icons,
  };
}
