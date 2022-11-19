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

import {
  addon as CUDF,
  DataFrame,
  Float32,
  Int32,
  scope,
  Series,
} from '@rapidsai/cudf';
import {DedupedEdgesGraph, Graph} from '@rapidsai/cugraph';
import {PreshapedEdges} from '../../types';

import {ageFactor} from '../types';

export function makeIcons(
  edges: DataFrame<PreshapedEdges>,
  deduped = DedupedEdgesGraph.fromEdgeList<Int32>(edges.get('src'), edges.get('dst')).edgeIds) {
  const icons = getIcons(edges, deduped);
  const id    = Series.sequence({size: icons.numRows});
  return icons.assign({
    id,
    age: icons.get('age').mul(negativeAgeFactorReciprocalScalar),
  });
}

function getIcons(edges: DataFrame<PreshapedEdges>,
                  deduped: DataFrame<{id: Int32; src: Int32; dst: Int32;}>) {
  return scope(() => joinEdgesAndIcons(groupEdgesAndIcons(edges, deduped))
                       .rename({lvl: 'icon'})
                       .sortValues({edge: {ascending: true}, age: {ascending: true}}),
               [edges, deduped]);
}

function groupEdgesAndIcons(frame: DataFrame<PreshapedEdges>,
                            deduped: DataFrame<{id: Int32; src: Int32; dst: Int32;}>) {
  return scope(() => {
    const elist = scope(() => {
      const g = Graph.fromEdgeList<Int32>(frame.get('src'), frame.get('dst'));
      return g.edgeIds.drop(['id'])
        .assign({
          lvl: frame.get('lvl'),
          age: frame.get('dt'),
          data: frame.get('data'),
        })
        .join({how: 'left', on: ['src', 'dst'], other: deduped})
        .sortValues({id: {ascending: true}});
    }, [frame, deduped]);

    const edges = scope(() => {
      return elist.select(['src', 'dst', 'id'])
        .groupBy({by: ['src', 'dst'], index_key: 'src_dst'})
        .min()
        .rename({id: 'edge'});
    }, [elist]);

    const icons = scope(() => {
      return elist.select(['src', 'dst', 'lvl', 'age', 'data'])
        .groupBy({by: ['src', 'dst'], index_key: 'src_dst'})
        .collectList();
    }, [elist]);

    return {edges, icons};
  }, [frame, deduped]);
}

function joinEdgesAndIcons({edges, icons}: ReturnType<typeof groupEdgesAndIcons>) {
  return scope(() => {
    const {age, lvl, str, sds} = scope(() => {
      const lvl  = icons.select(['src_dst', 'lvl']).flatten(['lvl'], false);
      const str  = icons.select(['data']).flatten(['data'], false);
      const age  = icons.select(['age']).flatten(['age'], false);
      const icon = Series.sequence({size: age.numRows});
      return {
        age: age.assign({icon}),
        str: str.assign({icon}),
        lvl: lvl.drop(['src_dst']).assign({icon}),
        sds: lvl.drop(['lvl']).assign({icon}),
      };
    }, [icons]);

    return edges
      .join({
        on: ['src_dst'],
        other: age  //
                 .join({on: ['icon'], other: str})
                 .join({on: ['icon'], other: lvl})
                 .join({on: ['icon'], other: sds})
                 .drop(['icon'])
      })
      .drop(['src_dst']);
  }, [edges, icons]);
}

const negativeAgeFactorReciprocalScalar =
  new CUDF.Scalar({type: new Float32, value: -1 / ageFactor});
