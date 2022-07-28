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

import {DataFrame, scope, Series, Utf8String} from '@rapidsai/cudf';
import {AsyncIterableX} from 'ix/asynciterable';

import * as Ix from '../ix';
import {PreshapedEdges} from '../types';
import {fromArrow} from '../utils';

import {makeEdges} from './shape/edges';
import {makeGraph} from './shape/graph';
import {makeIcons} from './shape/icons';
import {makeNodes} from './shape/nodes';
import {MainProcessChannels, SocketUpdate} from './types';

const readEdges = (data: Uint8Array) =>
  scope(() => fromArrow<PreshapedEdges>(data).select(['src', 'dst', 'lvl', 'dt', 'data']));

function shape(curEdges: DataFrame<PreshapedEdges>,
               newEdges: DataFrame<PreshapedEdges> = curEdges) {
  const graph = makeGraph(newEdges);
  const nodes = makeNodes(graph);
  const edges = makeEdges(graph, nodes);
  const icons = makeIcons(
    newEdges, curEdges === newEdges ? graph.edgeIds.select(['id', 'src', 'dst']) : undefined);
  return {oldEdges: newEdges, shaped: {nodes, edges, icons}};
}

export function withShaper(channels: MainProcessChannels) {
  return function shapeUpdates(updates: AsyncIterableX<SocketUpdate>) {
    return updates
      .pipe(Ix.ai.ops.scan({
        callback: ({oldEdges}, {kind, index, data, dueTime}) => ({
          kind,
          index,
          dueTime,
          ...(kind === 'replace' ? shape(readEdges(data))
                                 : shape(oldEdges, oldEdges.concat(readEdges(data))))
        }),
        seed: {
          index: 0,
          dueTime: 0,
          kind: 'replace' as 'replace' | 'append',
          oldEdges: new DataFrame({
            src: Series.new(new Int32Array()),
            dst: Series.new(new Int32Array()),
            lvl: Series.new(new Int32Array()),
            dt: Series.new(new Int32Array()),
            data: Series.new({type: new Utf8String, data: []}),
          }),
          shaped: {
            nodes: new DataFrame({
              id: Series.new(new Int32Array()),
              size: Series.new(new Uint8Array()),
              color: Series.new(new Uint32Array()),
            }),
            edges: new DataFrame({
              id: Series.new(new Int32Array()),
              src: Series.new(new Int32Array()),
              dst: Series.new(new Int32Array()),
              color: Series.new(new BigUint64Array()),
              edge: Series.new(new BigUint64Array()),
              bundle: Series.new(new BigUint64Array()),
            }),
            icons: new DataFrame({
              id: Series.new(new Int32Array()),
              edge: Series.new(new Int32Array()),
              icon: Series.new(new Int32Array()),
              age: Series.new(new Float32Array()),
              data: Series.new({type: new Utf8String, data: []}),
            }),
          }
        },
      }))
      .pipe(Ix.ai.ops.map(({kind, index, dueTime, shaped}) =>
                            ({channels, kind: kind, index, dueTime, ...shaped})));
  }
}
