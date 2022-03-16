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

import {DataFrame, Float32, Int32, scope, Series} from '@rapidsai/cudf';
import {DedupedEdgesGraph, Graph} from '@rapidsai/cugraph';

export function makeIcons(src: Series<Int32>,
                          dst: Series<Int32>,
                          lvl: Series<Int32>,
                          deduped?: DataFrame<{id: Int32; src: Int32; dst: Int32;}>) {
  deduped ??= DedupedEdgesGraph.fromEdgeList<Int32>(src, dst).edgeIds;

  const grouped = scope(() => {
    const {ids, levels} = scope(() => {
      const edges = scope(() => {
        const g = Graph.fromEdgeList<Int32>(src, dst);
        return g.edgeIds.drop(['id'])
          .assign({lvl})
          .join({how: 'left', on: ['src', 'dst'], other: deduped})
          .sortValues({id: {ascending: true}});
      }, [src, dst, lvl, deduped]);

      const ids = scope(() => {
        return edges.select(['src', 'dst', 'id'])
          .groupBy({by: ['src', 'dst'], index_key: 'src_dst'})
          .min()
          .rename({id: 'edge'});
      }, [edges]);

      const levels = scope(() => {
        return edges.select(['src', 'dst', 'lvl'])
          .groupBy({by: ['src', 'dst'], index_key: 'src_dst'})
          .collectList()
          .rename({lvl: 'icon'});
      }, [edges]);

      return {ids, levels};
    }, [src, dst, lvl, deduped]);

    return ids.join({on: ['src_dst'], other: levels}).drop(['src_dst']).sortValues({
      edge: {ascending: true}
    });
  }, [src, dst, lvl, deduped]);

  const icons = grouped.flatten();

  return icons.assign({
    id: Series.sequence({size: icons.numRows}),
    age: grouped.get('icon').flattenIndices().mul(-500).cast(new Float32)
  });
}
