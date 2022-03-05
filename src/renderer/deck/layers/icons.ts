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
    };
  }

  static getAccessors({ gl }: { gl: WebGLRenderingContext }) {
    return {
      instanceAge: { size: 1, type: gl.FLOAT, accessor: 'getAge' },
      instanceEdge: { size: 1, type: gl.INT, accessor: 'getEdge' },
      instanceIcon: { size: 1, type: gl.INT, accessor: 'getIcon' },
      instanceSize: { size: 1, type: gl.FLOAT, accessor: 'getSize' },
    };
  }

  protected declare props: any;
  protected declare state: any;
  setState(newState: any) { return super.setState(newState); }
  getAttributeManager() { return super.getAttributeManager(); }

  constructor(...args: any[]) {
    super(...args);
  }

  getShaders() {
    return Layer.prototype.getShaders.call(this, { vs, fs, modules: [project32, picking] });
  }

  initializeState(context: any) {
    super.initializeState(context);
    const manager = this.getAttributeManager();
    const attributes = manager.getAttributes();
    manager.remove(Object.keys(attributes));
    manager.addInstanced(IconLayer.getAccessors(context));
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
}
