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

import { Accessor } from '@luma.gl/webgl';

import { IconAtlas } from './atlas';
import { Buffer, copyDtoH, Texture2D } from './luma.gl';
import { RenderMessage, getTextureSize, TextureFormats } from '../types';

export class DeviceBuffers {

  public edge: {
    length: number;
    id: Buffer;
    edge: Buffer;
    color: Buffer;
    bundle: Buffer;
    edgeTex: Texture2D;
    bundleTex: Texture2D;
  };
  public icon: {
    length: number;
    id: Buffer;
    age: Buffer;
    icon: Buffer;
    edge: Buffer;
  };
  public node: {
    length: number;
    id: Buffer;
    color: Buffer;
    radius: Buffer;
    xPositionTex: Texture2D;
    yPositionTex: Texture2D;
  };
  constructor(opts: {
    edge?: Partial<DeviceBuffers['edge']>
    icon?: Partial<DeviceBuffers['icon']>
    node?: Partial<DeviceBuffers['node']>
  } = {}) {
    this.edge = <any>Object.assign(this.edge || {}, opts.edge || {});
    this.icon = <any>Object.assign(this.icon || {}, opts.icon || {});
    this.node = <any>Object.assign(this.node || {}, opts.node || {});
  }
}

type TypedArray = Int8Array | Int32Array | Uint8Array | Uint32Array | Float32Array | BigUint64Array;

export class RenderState extends DeviceBuffers {
  public frameNo: number;
  public canvas: HTMLCanvasElement;
  public gl: WebGL2RenderingContext;
  public bbox: [number, number, number, number];

  public iconAtlas: Texture2D;
  public iconAtlasFrame: Texture2D;
  public iconAtlasOffset: Texture2D;

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    super();
    this.gl = gl;
    this.frameNo = -1;
    this.canvas = canvas;
    (canvas as any).gl = this.gl;
  }

  copyDynamicBuffers({ bbox, edge, icon, node }: RenderMessage) {
    const { gl } = this;
    this.frameNo++;
    this.bbox = bbox.slice() as (typeof this.bbox);
    this.icon.age = this.copyToBuffer(icon.age, this.icon.age, { size: 1 });
    this.node.xPositionTex = this.copyToFloatTexture2D('RGBA32F', node.xPosition, this.node.xPositionTex);
    this.node.yPositionTex = this.copyToFloatTexture2D('RGBA32F', node.yPosition, this.node.yPositionTex);
    return this;
  }

  copyIconAtlas(atlas: IconAtlas) {
    const { gl } = this;
    this.iconAtlas = this.copyImageDataToTexture2D(atlas.atlas, this.iconAtlas);
    this.iconAtlasFrame = this.copyToFloatTexture2D('RGBA32F', atlas.frame, this.iconAtlasFrame);
    this.iconAtlasOffset = this.copyToFloatTexture2D('RGBA32F', atlas.offset, this.iconAtlasOffset);
    return this;
  }

  copyNodeBuffers({ bbox, edge, icon, node }: RenderMessage) {
    const { gl } = this;
    this.node.length = node.id.length;
    this.node.id = this.copyToBuffer(node.id, this.node.id, { size: 1 });
    this.node.color = this.copyToBuffer(node.color, this.node.color, { size: 4, type: gl.UNSIGNED_BYTE });
    this.node.radius = this.copyToBuffer(node.radius, this.node.radius, { size: 1, type: gl.UNSIGNED_BYTE });
    return this;
  }

  copyEdgeBuffers({ bbox, edge, icon, node }: RenderMessage) {
    const { gl } = this;
    this.edge.length = edge.id.length;
    this.edge.id = this.copyToBuffer(edge.id, this.edge.id, { size: 1 });
    this.edge.edge = this.copyToBuffer(edge.edge, this.edge.edge, { size: 2, type: gl.INT });
    this.edge.color = this.copyToBuffer(edge.color, this.edge.color, { size: 8, type: gl.UNSIGNED_BYTE });
    this.edge.bundle = this.copyToBuffer(edge.bundle, this.edge.bundle, { size: 2, type: gl.INT });
    this.edge.edgeTex = this.copyToFloatTexture2D(
      'RGBA32F', new Float32Array(new Uint32Array(edge.edge.buffer)), this.edge.edgeTex
    );
    this.edge.bundleTex = this.copyToFloatTexture2D(
      'RGBA32F', new Float32Array(new Uint32Array(edge.bundle.buffer)), this.edge.bundleTex
    );
    return this;
  }

  copyIconBuffers({ bbox, edge, icon, node }: RenderMessage) {
    const { gl } = this;
    this.icon.length = icon.age.length;
    this.icon.id = this.copyToBuffer(icon.id, this.icon.id, { size: 1, type: gl.INT });
    this.icon.icon = this.copyToBuffer(icon.icon, this.icon.icon, { size: 1, type: gl.INT });
    this.icon.edge = this.copyToBuffer(icon.edge, this.icon.edge, { size: 1, type: gl.INT });
    return this;
  }

  public copyToBuffer(
    data: TypedArray,
    buffer?: Buffer | null,
    accessor: Partial<Accessor> = {}) {
    accessor = { size: 1, type: getGLTypeFromTypedArray(this.gl, data), ...accessor };
    (buffer || (buffer = new Buffer(this.gl))).setAccessor(accessor);
    buffer.reallocate(data.byteLength);
    return buffer.subData({ data });
  }

  public copyToBufferAligned(
    data: TypedArray,
    buffer?: Buffer | null,
    accessor: Partial<Accessor> = {}
  ) {
    accessor = { size: 1, type: getGLTypeFromTypedArray(this.gl, data), ...accessor };
    const BPV = Accessor.getBytesPerVertex(accessor);
    const BPE = Accessor.getBytesPerElement(accessor);
    const { length } = getTextureSize('RGBA32F', data.length * BPV, BPE);
    (buffer || (buffer = new Buffer(this.gl))).setAccessor(accessor);
    buffer.reallocate(length * BPV);
    return buffer.subData({ data });
  }

  public emptyBuffer(length: number, buffer?: Buffer | null, accessor: Partial<Accessor> = {}) {
    accessor = { size: 1, type: this.gl.FLOAT, ...accessor };
    (buffer || (buffer = new Buffer(this.gl))).setAccessor(accessor);
    buffer.reallocate(length * Accessor.getBytesPerVertex(buffer.accessor));
    return buffer;
  }

  public emptyBufferAligned(length: number, buffer?: Buffer | null, accessor: Partial<Accessor> = {}) {
    accessor = { size: 1, type: this.gl.FLOAT, ...accessor };
    const BPV = Accessor.getBytesPerVertex(accessor);
    const BPE = Accessor.getBytesPerElement(accessor);
    ({ length } = getTextureSize('RGBA32F', length * BPV, BPE));
    (buffer || (buffer = new Buffer(this.gl))).setAccessor(accessor);
    buffer.reallocate(length * BPV);
    return buffer;
  }

  public emptyFloatTexture2D(format: TextureFormats, size: number, texture?: Texture2D | null) {
    return (texture || this.makeFloatTexture2D(format, new Float32Array())).resize(getTextureSize(format, size * 4, 4));
  }

  public copyToFloatTexture2D(format: TextureFormats, data: Float32Array, texture?: Texture2D | null) {
    if (!texture) {
      return this.makeFloatTexture2D(format, data);
    }
    const { width, height, data: data_ } = getTextureSizeAndData(format, data);
    return texture.resize({ width, height }).setSubImageData({ data: data_ });
  }

  public copyImageDataToTexture2D(data: ImageData, texture?: Texture2D | null) {
    return texture?.setSubImageData(data) || new Texture2D(this.gl, { data, format: this.gl.RGBA });
  }

  public makeFloatTexture2D(format: TextureFormats, data: Float32Array) {
    return getTexture(this.gl, format, data);
  }
}

function getTexture(gl: WebGL2RenderingContext, format: TextureFormats, data: Float32Array) {
  const sizeAndData = getTextureSizeAndData(format, data);
  return new Texture2D(gl, {
    format: gl[format],
    mipmaps: false,
    type: gl.FLOAT,
    ...sizeAndData,
    parameters: {
      [gl.TEXTURE_MIN_FILTER]: [gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER]: [gl.NEAREST],
      [gl.TEXTURE_WRAP_S]: [gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T]: [gl.CLAMP_TO_EDGE],
    },
    pixelStore: {
      [gl.UNPACK_FLIP_Y_WEBGL]: false,
      [gl.UNPACK_COLORSPACE_CONVERSION_WEBGL]: gl.NONE,
    }
  });
}

function getTextureSizeAndData(format: TextureFormats, data: Float32Array) {
  const { width, height, length } = getTextureSize(format, data.byteLength, data.BYTES_PER_ELEMENT);
  if (data.length < length) {
    const b = new (data as any).constructor(length);
    b.set(data);
    data = b;
  }
  return { data, width, height };
}

function getGLTypeFromTypedArray(gl: WebGL2RenderingContext, data: TypedArray) {
  switch (data.constructor) {
    case Int8Array: return gl.BYTE;
    case Int32Array: return gl.INT;
    case Uint8Array: return gl.UNSIGNED_BYTE;
    case Uint32Array: return gl.UNSIGNED_INT;
    case BigUint64Array: return gl.UNSIGNED_INT;
    case Float32Array:
    default: return gl.FLOAT;
  }
}
