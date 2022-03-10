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
import { Layer, project32, picking } from '@deck.gl/core';
// @ts-expect-error
import { IconLayer as DeckIconLayer } from '@deck.gl/layers';

import { PickingInfo } from '../deck.gl';

import vs from './icons/icon-vertex.glsl';
import fs from './icons/icon-fragment.glsl';

export class IconLayer extends DeckIconLayer {
  static get layerName() { return 'IconLayer'; }

  static get defaultProps() {
    return {
      opacity: 1,
      visible: true,
      sizeScale: 1,
      sizeMinPixels: 5,
      sizeMaxPixels: 150,
      highlightedIcon: -1,
    };
  }

  static getAccessors({ gl }: { gl: WebGLRenderingContext }) {
    return {
      instanceId: { size: 1, type: gl.INT, accessor: 'getId' },
      instanceAge: { size: 1, type: gl.FLOAT, accessor: 'getAge' },
      instanceEdge: { size: 1, type: gl.INT, accessor: 'getEdge' },
      instanceIcon: { size: 1, type: gl.INT, accessor: 'getIcon' },
      instanceSize: { size: 1, type: gl.FLOAT, accessor: 'getSize' },
    };
  }

  protected declare props: any;
  protected declare state: any;
  protected declare internalState: any;
  setState(newState: any) { return super.setState(newState); }
  getAttributeManager() { return super.getAttributeManager(); }

  constructor(...args: any[]) {
    super(...args);
  }

  getShaders() {
    return Layer.prototype.getShaders.call(this, { vs, fs, modules: [project32, picking] });
  }

  initializeState(context: any) {
    this.internalState.highlightedIconId = -1;
    this.internalState.highlightedIconLevel = -1;
    this.internalState.highlightedIconIndex = -1;
    super.initializeState(context);
    this.getAttributeManager().addInstanced(IconLayer.getAccessors(context));
  }

  shouldUpdateState({ props, oldProps, changeFlags, ...rest }: any) {
    return props.numInstances > 0 ||
      changeFlags.viewportChanged ||
      super.shouldUpdateState({ props, changeFlags, oldProps, ...rest });
  }

  draw({ uniforms, ...rest }: { uniforms?: any, context?: any } = {}) {
    const result = super.draw({
      ...rest,
      uniforms: {
        ...uniforms,
        maxAge: 5000,
        opacity: this.props.opacity,
        edgeTex: this.props.edgeTex,
        bundleTex: this.props.bundleTex,
        xPositionTex: this.props.xPositionTex,
        yPositionTex: this.props.yPositionTex,
        highlightedIcon: this.props.highlightedIcon,
        iconAtlasFrameTex: this.props.iconAtlasFrame,
        iconAtlasOffsetTex: this.props.iconAtlasOffset,
        edgeTexSize: [this.props.edgeTex.width, this.props.edgeTex.height],
        bundleTexSize: [this.props.bundleTex.width, this.props.bundleTex.height],
        xPositionTexSize: [this.props.xPositionTex.width, this.props.xPositionTex.height],
        yPositionTexSize: [this.props.yPositionTex.width, this.props.yPositionTex.height],
        iconAtlasFrameTexSize: [this.props.iconAtlasFrame.width, this.props.iconAtlasFrame.height],
        iconAtlasOffsetTexSize: [this.props.iconAtlasOffset.width, this.props.iconAtlasOffset.height],
      }
    });
    return result;
  }

  getPickingInfo({ mode, info }: { info: PickingInfo, mode: 'hover' | 'click' }) {
    if (info.index === -1) {
      info.iconId = -1;
      info.iconLevel = -1;
    } else if (info.index === this.internalState.highlightedIconIndex) {
      info.iconId = this.internalState.highlightedIconId;
      info.iconLevel = this.internalState.highlightedIconLevel;
    } else {
      ([info.iconId] = copyFromAttributeDtoH(info.index, this.props.data.attributes.instanceId));
      ([info.iconLevel] = copyFromAttributeDtoH(info.index, this.props.data.attributes.instanceIcon));
    }
    this.internalState.highlightedIconId = info.iconId;
    this.internalState.highlightedIconIndex = info.index;
    this.internalState.highlightedIconLevel = info.iconLevel;
    info.object = info.index;  // deck.gl uses info.object to check if item has already been added
    return info;
  }
}

function copyFromAttributeDtoH(index: number, attr: any, size = 1) {
  const { buffer, offset = 0 } = attr;
  return buffer.getData({
    length: size,
    srcByteOffset: <number>offset + (index * buffer.accessor.BYTES_PER_VERTEX),
  });
}
