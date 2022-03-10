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

import { logRuntime } from '../../utils';
import { Graph, DedupedEdgesGraph, renumberNodes, renumberEdges } from '@rapidsai/cugraph';
import { DataFrame, Series, Float32, Int32, Uint8, Uint32, Uint64, scope } from '@rapidsai/cudf';
import { PreshapedEdges, ShapedNodes, ShapedEdges, ShapedIcons } from '../../types';

interface Shaped {
  graph: DedupedEdgesGraph<Int32>;
  nodes: DataFrame<ShapedNodes>;
  edges: DataFrame<ShapedEdges>;
  icons: DataFrame<ShapedIcons>;
};

export async function* shape(source: AsyncIterable<{ type: 'replace' | 'append', edges: Uint8Array }>) {

  let curEdges = new DataFrame({
    src: Series.new(new Int32Array()),
    dst: Series.new(new Int32Array()),
    lvl: Series.new(new Int32Array()),
    // expire: Series.new(new Float64Array()),
  });

  let shaped: Shaped = {
    graph: null,
    nodes: new DataFrame({
      id: Series.new(new Int32Array()),
      size: Series.new(new Uint8Array()),
      color: Series.new(new Uint32Array()),
    }),
    edges: new DataFrame({
      id: Series.new(new Int32Array()),
      color: Series.new(new BigUint64Array()),
      edge: Series.new(new BigUint64Array()),
      bundle: Series.new(new BigUint64Array()),
    }),
    icons: new DataFrame({
      id: Series.new(new Int32Array()),
      edge: Series.new(new Int32Array()),
      icon: Series.new(new Int32Array()),
      age: Series.new(new Float32Array()),
    }),
  };

  for await (const value of source) {
    yield logRuntime('\nshape', () => {

      const newEdges = DataFrame.fromArrow<PreshapedEdges>(value.edges);

      if (value.type === 'replace') {
        curEdges = newEdges;
        shaped.graph = makeGraph(curEdges);
        shaped.nodes = makeNodes(shaped.graph);
        shaped.edges = makeEdges(shaped.graph, shaped.nodes);
        shaped.icons = makeIcons(
          curEdges.get('src'),
          curEdges.get('dst'),
          curEdges.get('lvl'),
          shaped.graph.edgeIds.select(['id', 'src', 'dst']));
      } else {
        // Append new edges
        curEdges = curEdges.concat(newEdges);
        // Remove edges older than 10s
        // curEdges = curEdges.filter(curEdges.get('expire').ge(performance.now())).concat(newEdges);
        shaped.graph = makeGraph(curEdges);
        shaped.nodes = makeNodes(shaped.graph);
        shaped.edges = makeEdges(shaped.graph, shaped.nodes);
        shaped.icons = makeIcons(
          newEdges.get('src'),
          newEdges.get('dst'),
          newEdges.get('lvl')
        );
      }

      return { type: value.type, ...shaped };
    });
  }
}

function makeGraph(preshapedEdges: DataFrame<PreshapedEdges>) {
  return logRuntime('makeGraph', () => {

    const deduped = new DataFrame({
      src: preshapedEdges.get('src'),
      dst: preshapedEdges.get('dst'),
      id: Series.sequence({ size: preshapedEdges.numRows })
    })
      .groupBy({ by: ['src', 'dst'], index_key: 'src_dst' })
      .min()
      .sortValues({ id: { ascending: true } });

    const src = deduped.get('src_dst').getChild('src');
    const dst = deduped.get('src_dst').getChild('dst');
    const nodes = renumberNodes(src, dst);
    const edges = renumberEdges(src, dst,
      Series.sequence({ type: new Float32, size: src.length, init: 1, step: 0 }),
      nodes
    );

    return new (DedupedEdgesGraph as any)(nodes, edges, { directed: true }) as DedupedEdgesGraph<Int32>;
  });
}

function makeNodes(graph: DedupedEdgesGraph<Int32>) {
  return logRuntime('makeNodes', () => graph.nodeIds.assign({
    size: nodeSizes(graph),
    color: nodeColors(graph),
  }));
}

function makeEdges(graph: DedupedEdgesGraph<Int32>, nodes: DataFrame<ShapedNodes>) {
  return logRuntime('makeEdges', () => {
    return graph.edgeIds.select(['id']).assign({
      edge: graph.edgeIds.select(['src', 'dst']).interleaveColumns().view(new Uint64),
      color: edgeColors(
        nodes.select(['id', 'color']),
        graph.edgeIds.select(['id', 'src', 'dst'])
      ),
      bundle: new DataFrame({
        eindex: Series.sequence({ size: graph.numEdges, init: 0, step: 0 }),
        bcount: Series.sequence({ size: graph.numEdges, init: 1, step: 0 }),
      }).interleaveColumns().view(new Uint64),
    });
  });
}

function nodeSizes(graph: Graph<Int32>) {
  return logRuntime('nodeSizes', () => {
    return scope(() => {
      return graph.degree().get('degree')
        .scale().mul(254).add(1).cast(new Uint8)
    }, [graph]);
  });
}

const defaultPaletteColors = new Uint32Array([
  // # https://colorbrewer2.org/#type=diverging&scheme=Spectral&n=9
  '#f46d43', // (orange)
  '#d53e4f', // (light-ish red)
  // '#fdae61', // (light orange)
  '#fee08b', // (yellow)
  '#ffffbf', // (yellowish white)
  '#e6f598', // (light yellowish green)
  '#abdda4', // (light green)
  '#66c2a5', // (teal)
  '#3288bd', // (blue)

  '#76b900', // NVIDIA green
  '#1A1918', // NVIDIA black
].map(hexToInt));

function hexToInt(x: string) { return parseInt('0xff' + x.slice(1), 16); }

const defaultPaletteSeries = Series.new(defaultPaletteColors);

function nodeColors(graph: DedupedEdgesGraph<Int32>, palette = defaultPaletteSeries) {
  return logRuntime('nodeColors', () => {
    return palette.gather(Series.sequence({ size: graph.numNodes, init: 8, step: 0 }));
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
  });
}

function edgeColors(
  nodes: DataFrame<{ id: Int32, color: Uint32 }>,
  edges: DataFrame<{ id: Int32, src: Int32, dst: Int32 }>) {
  return new DataFrame({
    src: defaultPaletteSeries.gather(Series.sequence({ size: edges.numRows, init: 8, step: 0 })),
    dst: defaultPaletteSeries.gather(Series.sequence({ size: edges.numRows, init: 8, step: 0 })),
  }).interleaveColumns().view(new Uint64);
  // return scope(() => {
  //   const src = edges
  //     .select(['id', 'src'])
  //     .join({ on: ['src'], other: nodes.rename({ id: 'src' }) })
  //     .sortValues({ id: { ascending: true } })
  //     .get('color');
  //   const dst = edges
  //     .select(['id', 'dst'])
  //     .join({ on: ['dst'], other: nodes.rename({ id: 'dst' }) })
  //     .sortValues({ id: { ascending: true } })
  //     .get('color');
  //   return new DataFrame({ src, dst }).interleaveColumns().view(new Uint64);
  // }, [nodes, edges]);
}

function makeIcons(
  src: Series<Int32>,
  dst: Series<Int32>,
  lvl: Series<Int32>,
  deduped?: DataFrame<{ id: Int32; src: Int32; dst: Int32; }>) {
  return logRuntime('makeIcons', () => {

    deduped ??= DedupedEdgesGraph.fromEdgeList<Int32>(src, dst).edgeIds;

    const grouped = scope(() => {

      const { ids, levels } = scope(() => {

        const edges = scope(() => {
          const g = Graph.fromEdgeList<Int32>(src, dst);
          return g.edgeIds.drop(['id']).assign({ lvl })
            .join({ how: 'left', on: ['src', 'dst'], other: deduped })
            .sortValues({ id: { ascending: true } });
        }, [src, dst, lvl, deduped]);

        const ids = scope(() => {
          return edges
            .select(['src', 'dst', 'id'])
            .groupBy({ by: ['src', 'dst'], index_key: 'src_dst' })
            .min().rename({ id: 'edge' });
        }, [edges]);

        const levels = scope(() => {
          return edges
            .select(['src', 'dst', 'lvl'])
            .groupBy({ by: ['src', 'dst'], index_key: 'src_dst' })
            .collectList().rename({ lvl: 'icon' });
        }, [edges]);

        return { ids, levels };
      }, [src, dst, lvl, deduped]);

      return ids
        .join({ on: ['src_dst'], other: levels })
        .drop(['src_dst'])
        .sortValues({ edge: { ascending: true } });
    }, [src, dst, lvl, deduped]);

    const icons = grouped.flatten();

    return icons.assign({
      id: Series.sequence({ size: icons.numRows }),
      age: grouped
        .get('icon').flattenIndices()
        .mul(-1000).cast(new Float32)
    });
  });
}
