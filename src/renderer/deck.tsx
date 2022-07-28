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

import * as React from 'react';

// @ts-expect-error
import DeckGL from '@deck.gl/react';
// @ts-expect-error
import { OrthographicView } from '@deck.gl/core';

import { RenderState } from './types';
import { EdgeLayer } from './deck/layers/edges';
import { NodeLayer } from './deck/layers/nodes';
import { IconLayer } from './deck/layers/icons';

interface DeckProps {
  style?: any;
  width?: string | number;
  height?: string | number;
  autoCenter: boolean;
  renderState: RenderState;
  setAutoCenter: (autoCenter: boolean) => void;
  onWebGLInitialized: (gl: WebGL2RenderingContext) => void;
}

interface HoverInfo {
  x?: number;
  y?: number;
  edgeId?: number;
  nodeId?: number;
  iconId?: number;
  iconLevel?: number;
  sourceNodeId?: number;
  targetNodeId?: number;
}

export const Deck = ({ renderState, autoCenter, setAutoCenter, ...props }: DeckProps) => {

  const ref = React.useRef(null);
  const [tooltip, setTooltip] = React.useState(null);
  const [highlights, setHighlights] = React.useState({
    highlightedIcon: -1,
    highlightedEdge: -1,
    highlightedNode: -1,
    highlightedSourceNode: -1,
    highlightedTargetNode: -1,
  });

  const initialViewState = autoCenter && centerOnBbox(
    renderState?.bbox || [NaN, NaN, NaN, NaN],
    [
      ref.current?.deck?.canvas?.offsetWidth ?? window.outerWidth,
      ref.current?.deck?.canvas?.offsetHeight ?? window.outerHeight
    ]);

  const textures = {
    edgeTex: renderState?.edge.edgeTex,
    bundleTex: renderState?.edge.bundleTex,
    xPositionTex: renderState?.node.xPositionTex,
    yPositionTex: renderState?.node.yPositionTex,
  };

  // const [
  //   tooltipX = tooltip?.x,
  //   tooltipY = tooltip?.y,
  // ] = (ref.current as any)?.deck?.animationLoop?.animationProps?._mousePosition || [];

  if ((ref.current as any)?.deck?.tooltip?.el) {
    (ref.current as any).deck.tooltip.remove();
  }

  return (
    <DeckGL
      width='100%'
      height='100%'
      {...props}
      ref={ref}
      views={[new OrthographicView()]}
      controller={{ keyboard: false }}
      initialViewState={initialViewState}
      onViewStateChange={() => setAutoCenter(false)}
      layers={renderState ? [
        edgeLayer(renderState, textures, highlights),
        nodeLayer(renderState, textures, highlights),
        iconLayer(renderState, textures, highlights)
      ] : []}
      onHover={(hovers: HoverInfo) => {
        setTooltip(getTooltip(hovers));
        setHighlights({
          highlightedIcon: hovers.iconId ?? -1,
          highlightedEdge: hovers.edgeId ?? -1,
          highlightedNode: hovers.nodeId ?? -1,
          highlightedSourceNode: hovers.sourceNodeId ?? -1,
          highlightedTargetNode: hovers.targetNodeId ?? -1,
        });
      }}
    >
      {tooltip && (
        <div
          className='deck-tooltip'
          style={{
            ...tooltip.style,
            zIndex: 1,
            // top: tooltipY,
            // left: tooltipX,
            right: 0,
            bottom: 0,
            maxWidth: `33%`,
            position: `absolute`,
            pointerEvents: `none`,
            wordBreak: 'break-all',
          }}>
          {tooltip.text}
        </div>
      )}
    </DeckGL>
  );
};

function edgeLayer(renderState: RenderState, textures: any, highlights: any) {
  return new EdgeLayer({
    pickable: true,
    autoHighlight: false,
    highlightColor: [225, 225, 225, 100],
    numInstances: renderState.edge.length,
    width: 2,
    opacity: .2,
    visible: true,
    ...textures,
    ...highlights,
    data: {
      attributes: {
        instanceId: { buffer: renderState.edge.id },
        instanceEdge: { buffer: renderState.edge.edge },
        instanceBundle: { buffer: renderState.edge.bundle },
        instanceSourceColor: { buffer: renderState.edge.color, offset: 0 },
        instanceTargetColor: { buffer: renderState.edge.color, offset: 4 },
      }
    },
  });
}

function nodeLayer(renderState: RenderState, textures: any, highlights: any) {
  return new NodeLayer({
    pickable: true,
    autoHighlight: false,
    highlightColor: [225, 225, 225, 100],
    numInstances: renderState.node.length,
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
        instanceId: { buffer: renderState.node.id },
        instanceRadius: { buffer: renderState.node.radius },
        instanceFillColor: { buffer: renderState.node.color },
        instanceLineColor: { buffer: renderState.node.color },
      }
    },
  });
}

function iconLayer(renderState: RenderState, textures: any, highlights: any) {
  return new IconLayer({
    parameters: { depthTest: true },
    pickable: true,
    billboard: true,
    autoHighlight: true,
    numInstances: renderState.icon.length,
    highlightColor: [225, 225, 225, 100],
    sizeUnits: 'pixels',
    opacity: 1,
    visible: true,
    sizeScale: 12.5,
    sizeMinPixels: 7,
    sizeMaxPixels: 150,
    iconMapping: undefined as any,
    iconAtlas: renderState.iconAtlas,
    iconAtlasFrame: renderState.iconAtlasFrame,
    iconAtlasOffset: renderState.iconAtlasOffset,
    ...textures,
    ...highlights,
    data: {
      attributes: {
        instanceId: { buffer: renderState.icon.id },
        instanceAge: { buffer: renderState.icon.age },
        instanceEdge: { buffer: renderState.icon.edge },
        instanceIcon: { buffer: renderState.icon.icon },
      }
    }
  });
}

const { ipcRenderer } = window.require('electron');

function getTooltip({ x, y, edgeId = -1, nodeId = -1, iconId = -1, sourceNodeId = -1, targetNodeId = -1, iconLevel = -1 }: HoverInfo) {
  const style: any = {
    size: 12,
    color: '#a0a7b4',
    padding: '2px',
    marginTop: '-6px',
    marginLeft: '12px',
    backgroundColor: 'rgba(26, 25, 24, 0.65)',
  };
  if (iconId !== -1) {
    if (iconLevel === 1) {
      style['backgroundColor'] = 'rgba(204, 0, 0, 0.65)';
    } else {
      style['color'] = 'rgba(0, 0, 0, 0.65)';
      style['backgroundColor'] = 'rgba(255, 255, 255, 0.65)';
    }
    return { x, y, style, text: `${ipcRenderer.sendSync('getIconData', iconId)}` };
  }
  if (nodeId !== -1) { return { x, y, style, text: ipcRenderer.sendSync('getNodeData', nodeId) }; }
  if (edgeId !== -1) { return { x, y, style, text: ipcRenderer.sendSync('getEdgeData', edgeId) }; }
  return null;
}

function centerOnBbox([minX, maxX, minY, maxY]: [number, number, number, number], [parentWidth, parentHeight]: [number, number]) {
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  if ((width === width) && (height === height)) {
    const xRatio = width / parentWidth;
    const yRatio = height / parentHeight;
    let zoom: number;
    if (xRatio > yRatio) {
      zoom = ((width > parentWidth) ? -(width / parentWidth) : (parentWidth / width)) * .9;
    } else {
      zoom = ((height > parentHeight) ? -(height / parentHeight) : (parentHeight / height)) * .9;
    }
    return {
      minZoom: Number.NEGATIVE_INFINITY,
      maxZoom: Number.POSITIVE_INFINITY,
      zoom: Math.log2(Math.abs(zoom)) * Math.sign(zoom),
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
