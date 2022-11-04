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

import {DataFrame, Float32, Int32, Series} from '@rapidsai/cudf';
import {DedupedEdgesGraph, renumberEdges, renumberNodes} from '@rapidsai/cugraph';

import {PreshapedEdges} from '../../types';

export function makeGraph(preshapedEdges: DataFrame<PreshapedEdges>) {
  const deduped = new DataFrame({
                    src: preshapedEdges.get('src'),
                    dst: preshapedEdges.get('dst'),
                    id: Series.sequence({size: preshapedEdges.numRows})
                  })
                    .groupBy({by: ['src', 'dst'], index_key: 'src_dst'})
                    .min()
                    .sortValues({id: {ascending: true}});

  const src   = deduped.get('src_dst').getChild('src');
  const dst   = deduped.get('src_dst').getChild('dst');
  const nodes = renumberNodes(src, dst);
  const edges = renumberEdges(
    src, dst, Series.sequence({type: new Float32, size: src.length, init: 1, step: 0}), nodes);

  return new (DedupedEdgesGraph as any)(nodes, edges, {directed: true}) as DedupedEdgesGraph<Int32>;
}
