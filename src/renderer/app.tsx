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

// @ts-expect-error
import { log as lumaLog } from '@luma.gl/core';
// @ts-expect-error
import { log as deckLog } from '@deck.gl/core';

import '@luma.gl/debug';

const debug = !true;
deckLog.level = 0;
lumaLog.level = 0;
deckLog.enable(debug || true);
lumaLog.enable(debug || true);

// @ts-expect-error
import { Deck, OrthographicView } from '@deck.gl/core';

import { NodeLayer } from './deck/layers/nodes';
import { EdgeLayer } from './deck/layers/edges';
import { IconLayer } from './deck/layers/icons';
import { RenderState } from './types';

export type AppState = {
  autoCenter: boolean;
  deck: Deck;
  gl: WebGL2RenderingContext;
};


export function init() {
  return new Promise<AppState>((resolve) => {
    const state = {
      autoCenter: true,
      deck: new Deck({
        debug,
        width: '100%',
        height: '100%',
        views: new OrthographicView(),
        controller: { keyboard: false },
        initialViewState: { target: [0, 0, 0], zoom: 0 },
        onWebGLInitialized(gl: WebGL2RenderingContext) {
          resolve({ ...state, gl });
        },
        onHover({ edgeId = -1, nodeId = -1, sourceNodeId = -1, targetNodeId = -1 }: any) {
          state.deck.setProps({
            highlightedEdge: edgeId,
            highlightedNode: nodeId,
            highlightedSourceNode: sourceNodeId,
            highlightedTargetNode: targetNodeId,
          });
        }
      }),
    };
  });
}

export async function update(
  app: AppState,
  {
    bbox,
    node,
    edge,
    icon,
    iconAtlas,
    iconAtlasFrame,
    iconAtlasOffset
  }: RenderState
) {
  let { deck, autoCenter } = app;
  const textures = {
    edgeTex: edge.edgeTex,
    bundleTex: edge.bundleTex,
    xPositionTex: node.xPositionTex,
    yPositionTex: node.yPositionTex,
  };
  const highlights = {
    highlightedNode: deck.props.highlightedNode ?? -1,
    highlightedEdge: deck.props.highlightedEdge ?? -1,
    highlightedSourceNode: deck.props.highlightedSourceNode ?? -1,
    highlightedTargetNode: deck.props.highlightedTargetNode ?? -1,
  };
  deck.setProps({
    onViewStateChange() { app.autoCenter = false; },
    initialViewState: autoCenter && centerOnBbox(bbox),
    layers: [
      new EdgeLayer({
        pickable: true,
        autoHighlight: false,
        highlightColor: [225, 225, 225, 100],
        numInstances: edge.length,
        width: 2,
        opacity: .5,
        visible: true,
        ...textures,
        ...highlights,
        data: {
          attributes: {
            instanceId: { buffer: edge.id },
            instanceEdge: { buffer: edge.edge },
            instanceBundle: { buffer: edge.bundle },
            instanceSourceColor: { buffer: edge.color, offset: 0 },
            instanceTargetColor: { buffer: edge.color, offset: 4 },
          }
        },
      }),

      new NodeLayer({
        pickable: true,
        autoHighlight: false,
        highlightColor: [225, 225, 225, 100],
        numInstances: node.length,
        filled: true,
        stroked: true,
        visible: true,
        fillOpacity: 0.5,
        strokeOpacity: .9,
        radiusScale: 1 / 75,
        radiusMinPixels: 5,
        radiusMaxPixels: 150,
        ...textures,
        ...highlights,
        data: {
          attributes: {
            instanceId: { buffer: node.id },
            instanceRadius: { buffer: node.radius },
            instanceFillColor: { buffer: node.color },
            instanceLineColor: { buffer: node.color },
          }
        },
      }),

      new IconLayer({
        pickable: false,
        billboard: true,
        autoHighlight: true,
        numInstances: icon.length,
        highlightColor: [225, 225, 225, 100],
        sizeUnits: 'pixels',
        opacity: 0.75,
        visible: true,
        sizeScale: 12.5,
        sizeMinPixels: 7,
        sizeMaxPixels: 150,
        iconMapping: undefined as any,
        iconAtlas,
        iconAtlasFrame,
        iconAtlasOffset,
        ...textures,
        getSize() { return 10; },
        data: {
          attributes: {
            instanceAge: { buffer: icon.age },
            instanceEdge: { buffer: icon.edge },
            instanceIcon: { buffer: icon.icon },
          }
        }
      }),
    ],
  });
  await deck.animationLoop.waitForRender();
  return app;
}

function centerOnBbox([minX, maxX, minY, maxY]: [number, number, number, number]) {
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  if ((width === width) && (height === height)) {
    const { outerWidth, outerHeight } = window;
    const world = (width > height ? width : height);
    const screen = (width > height ? outerWidth : outerHeight) * .9;
    const zoom = (world > screen ? -(world / screen) : (screen / world));
    return {
      minZoom: Number.NEGATIVE_INFINITY,
      maxZoom: Number.POSITIVE_INFINITY,
      zoom: Math.log(Math.abs(zoom)) * Math.sign(zoom),
      target: [minX + (width * .5), minY + (height * .5), 0],
    };
  }
  return {
    zoom: 1,
    target: [0, 0, 0],
    minZoom: Number.NEGATIVE_INFINITY,
    maxZoom: Number.POSITIVE_INFINITY,
  };
}
