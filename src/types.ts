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

import {Float32, Int32, Uint32, Uint64, Uint8} from '@rapidsai/cudf';

export type DataCursor = number|'prev'|'next'|'play'|'stop';

export class HostBuffers {
  public edge: {
    changed: boolean;        //
    id: Int32Array;          //
    edge: BigUint64Array;    //
    color: BigUint64Array;   //
    bundle: BigUint64Array;  //
  };
  public icon: {
    changed: boolean;   //
    id: Int32Array;     //
    age: Float32Array;  //
    icon: Int32Array;   //
    edge: Int32Array;   //
  };
  public node: {
    changed: boolean;         //
    id: Int32Array;           //
    color: Uint32Array;       //
    radius: Uint8Array;       //
    xPosition: Float32Array;  //
    yPosition: Float32Array;  //
  };
  constructor(opts: {
    edge?: Partial<HostBuffers['edge']>
    icon?: Partial<HostBuffers['icon']>
    node?: Partial<HostBuffers['node']>
  } = {}) {
    this.edge = <any>Object.assign({
      changed: false,
      id: new Int32Array(),
      edge: new BigUint64Array(),
      color: new BigUint64Array(),
      bundle: new BigUint64Array()
    },
                                   opts.edge || {});
    this.icon = <any>Object.assign({
      changed: false,
      id: new Int32Array(),
      age: new Float32Array(),
      icon: new Int32Array(),
      edge: new Int32Array(),
    },
                                   opts.icon || {});
    this.node = <any>Object.assign({
      changed: false,
      id: new Int32Array(),
      color: new Uint32Array(),
      radius: new Uint8Array(),
      xPosition: new Float32Array(),
      yPosition: new Float32Array(),
    },
                                   opts.node || {});
  }
}

export interface RenderMessage extends HostBuffers {
  index: number;
  count: number;
  bbox: [number, number, number, number];
}

export type PreshapedEdges = {
  src: Int32;  //
  dst: Int32;  //
  lvl: Int32   //
};
export type ShapedNodes = {
  id: Int32;      //
  color: Uint32;  //
  size: Uint8;    //
};
export type ShapedEdges = {
  id: Int32;       //
  src: Int32;      //
  dst: Int32;      //
  color: Uint64;   //
  edge: Uint64;    //
  bundle: Uint64;  //
};
export type ShapedIcons = {
  id: Int32;     //
  edge: Int32;   //
  icon: Int32;   //
  age: Float32;  //
};

export class LayoutParams {
  public active              = true;
  public outboundAttraction  = false;
  public linLogMode          = false;
  public edgeWeightInfluence = 0.0;
  public jitterTolerance     = 0.0001;
  public barnesHutTheta      = 0.0;
  public scalingRatio        = 5.0;
  public strongGravityMode   = true;
  public gravity             = 1.0;

  constructor(params: Partial<LayoutParams> = {}) { Object.assign(this, params); }

  toJSON() {
    return {
      active: this.active,
      outboundAttraction: this.outboundAttraction,
      linLogMode: this.linLogMode,
      edgeWeightInfluence: this.edgeWeightInfluence,
      jitterTolerance: this.jitterTolerance,
      barnesHutTheta: this.barnesHutTheta,
      scalingRatio: this.scalingRatio,
      strongGravityMode: this.strongGravityMode,
      gravity: this.gravity,
    };
  }
}

export type TextureFormats = 'R32F'|'RG32F'|'RGBA32F';

export function getTextureSize(
  format: TextureFormats, byteLength: number, BYTES_PER_ELEMENT: number) {
  const {alignTo, nComponents} = (() => {
    switch (format) {
      case 'R32F': return {alignTo: 32 >> 3, nComponents: 1};
      case 'RG32F': return {alignTo: 64 >> 3, nComponents: 2};
      case 'RGBA32F': return {alignTo: 128 >> 3, nComponents: 4};
    }
  })();

  const roundUp = (n: number, a: number) => Math.max(a, (n + (a - 1)) & ~(a - 1));

  const blen = roundUp(byteLength, alignTo);
  const size = Math.ceil(Math.sqrt(blen / (nComponents * BYTES_PER_ELEMENT)));

  return {width: size, height: size, length: size * size * nComponents};
}
