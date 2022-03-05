// Copyright (c) 2020, NVIDIA CORPORATION.
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

import { DeckContext, DeckLayer, PickingInfo, UpdateStateProps } from '../deck.gl';

// @ts-expect-error
import { Layer, picking, project32 } from '@deck.gl/core';

import { Geometry, Model } from '@luma.gl/engine';

import nodeFragmentShader from './nodes/node-fragment.glsl';
import nodeVertexShader from './nodes/node-vertex.glsl';

export class NodeLayer extends (Layer as typeof DeckLayer) {
  static get layerName() { return 'NodeLayer'; }
  static get defaultProps() {
    return {
      filled: true,
      stroked: true,
      strokeRatio: 0.05,
      fillOpacity: 1,
      strokeOpacity: 1,
      radiusScale: 1,
      lineWidthScale: 1,
      //  min point radius in pixels
      radiusMinPixels: 0,
      // max point radius in pixels
      radiusMaxPixels: Number.MAX_SAFE_INTEGER,
      lineWidthMinPixels: 0,
      lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,
      highlightedNode: -1,
      highlightedSourceNode: -1,
      highlightedTargetNode: -1,
    };
  }
  static getAccessors({ gl }: { gl: WebGLRenderingContext }) {
    return {
      instanceId: { size: 1, type: gl.INT, accessor: 'getNodeIndex' },
      instanceRadius: { size: 1, type: gl.UNSIGNED_BYTE, accessor: 'getRadius' },
      instanceFillColor: { size: 4, type: gl.UNSIGNED_BYTE, normalized: true, accessor: 'getFillColor' },
      instanceLineColor: { size: 4, type: gl.UNSIGNED_BYTE, normalized: true, accessor: 'getLineColor' },
    };
  }
  initializeState(context: DeckContext) {
    this.internalState.selectedNodeId = -1;
    this.internalState.highlightedNodeId = -1;
    this.internalState.selectedNodeIndex = -1;
    this.internalState.highlightedNodeIndex = -1;
    this.getAttributeManager().addInstanced(NodeLayer.getAccessors(context));
  }
  updateState({ props, oldProps, context, changeFlags }: UpdateStateProps) {
    ['selectedNodeId', 'highlightedNodeId', 'selectedNodeIndex', 'highlightedNodeIndex']
      .filter((key) => typeof props[key] === 'number')
      .forEach((key) => this.internalState[key] = props[key]);

    // if (this.internalState.highlightedNode && this.internalState.highlightedNode !== -1) {
    //   props.highlightedObjectIndex = this.internalState.highlightedNode;
    // }

    super.updateState({ props, oldProps, context, changeFlags });

    if (changeFlags.extensionsChanged) {
      if (this.state.model) { this.state.model.delete(); }
      this.setState({ model: this._getModel(context) });
      this.getAttributeManager().invalidateAll();
    }
  }
  serialize() {
    return {
      selectedNodeId: this.internalState.selectedNodeId,
      selectedNodeIndex: this.internalState.selectedNodeIndex,
      highlightedNodeId: this.internalState.highlightedNodeId,
      highlightedNodeIndex: this.internalState.highlightedNodeIndex,
    };
  }
  draw({ uniforms, ...rest }: { uniforms?: any, context?: DeckContext } = {}) {
    this.state.model.draw({
      ...rest,
      uniforms: {
        xPositionTex: this.props.xPositionTex,
        yPositionTex: this.props.yPositionTex,
        xPositionTexSize: [this.props.xPositionTex.width, this.props.xPositionTex.height],
        yPositionTexSize: [this.props.yPositionTex.width, this.props.yPositionTex.height],
        filled: !!this.props.filled,
        stroked: +(!!this.props.stroked),
        fillOpacity: this.props.fillOpacity,
        strokeRatio: this.props.strokeRatio,
        strokeOpacity: this.props.strokeOpacity,
        radiusScale: this.props.radiusScale,
        lineWidthScale: this.props.lineWidthScale,
        radiusMinPixels: this.props.radiusMinPixels,
        radiusMaxPixels: this.props.radiusMaxPixels,
        lineWidthMinPixels: this.props.lineWidthMinPixels,
        lineWidthMaxPixels: this.props.lineWidthMaxPixels,
        highlightedNode: this.props.highlightedNode,
        highlightedSourceNode: this.props.highlightedSourceNode,
        highlightedTargetNode: this.props.highlightedTargetNode,
        ...uniforms,
      }
    });
  }
  getPickingInfo({ mode, info }: { info: PickingInfo, mode: 'hover' | 'click' }) {
    if (info.index === -1) {
      info.nodeId = info.index;
    } else if (this.internalState.highlightedNodeIndex === info.index) {
      info.nodeId = this.internalState.highlightedNodeId;
    } else {
      const { buffer, offset = 0 } = this.props.data.attributes.instanceId;
      ([info.nodeId] = buffer.getData({
        length: 1,
        srcByteOffset: <number>offset + (info.index * buffer.accessor.BYTES_PER_VERTEX),
      }));
    }
    this.internalState.highlightedNodeId = info.nodeId;
    this.internalState.highlightedNodeIndex = info.index;
    if (mode === 'click') {
      this.internalState.selectedNodeId = this.internalState.highlightedNodeId;
      this.internalState.selectedNodeIndex = this.internalState.highlightedNodeIndex;
    }
    info.object = info.index;  // deck.gl uses info.object to check if item has already been added
    return info;
  }
  _getModel({ gl, shaderCache }: DeckContext) {
    return new Model(gl, <any>{
      id: this.props.id,
      shaderCache,
      modules: [project32, picking],
      vs: nodeVertexShader,
      fs: nodeFragmentShader,
      isInstanced: true,
      indexType: gl.UNSIGNED_INT,
      geometry: new Geometry({
        drawMode: gl.TRIANGLE_FAN,
        vertexCount: 4,
        attributes:
          { positions: { size: 3, value: new Float32Array([-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0]) } }
      }),
    });
  }
}
