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

import {
  Accessor,
  readPixelsToArray,
  Buffer as LumaBuffer,
  Texture2D as LumaTexture2D,
  Texture3D as LumaTexture3D,
  Framebuffer as LumaFramebuffer,
} from '@luma.gl/webgl';

export function copyDtoH(input: LumaBuffer | LumaTexture2D | LumaFramebuffer, ...args: any[]) {
  if (input instanceof LumaBuffer) {
    return input.getData(...args);
  }
  if (input instanceof LumaTexture2D || input instanceof LumaFramebuffer) {
    return readPixelsToArray(input, ...args);
  }
  return null;
}

export class Buffer extends LumaBuffer {
  declare debugData: any;
  declare accessor: Accessor;
  getDebugData() {
    this.debugData = this.getData({
      // luma.gl bug -- bytesUsed needs to be divided by BYTES_PER_ELEMENT
      length: Math.min(10, this.bytesUsed / this.accessor.BYTES_PER_ELEMENT)
    });
    return { data: this.debugData, changed: true };
  }
}

(LumaBuffer.prototype as any).getDebugData = Buffer.prototype.getDebugData;

export class Framebuffer extends LumaFramebuffer {
  update(options: {
    attachments?: {};
    readBuffer?: number;
    drawBuffers?: Iterable<number>;
    clearAttachments?: boolean;
    resizeAttachments?: boolean;
  } = {}) {
    return super.update({
      readBuffer: null,
      drawBuffers: null,
      ...options
    });
  }
}

export class Texture2D extends LumaTexture2D {
  setSubImageData(...args: Parameters<LumaTexture2D['setSubImageData']>) {
    super.setSubImageData(...args);
    return this;
  }
}

(LumaBuffer.prototype as any).setSubImageData = Texture2D.prototype.setSubImageData;

const texture3DSetImageData = LumaTexture3D.prototype.setImageData;

export class Texture3D extends LumaTexture3D {

  declare type: number;
  declare border: number;
  declare format: number;
  declare dataFormat: number;

  resize(opts: { depth?: number, width?: number, height?: number, mipmaps?: boolean }) {
    const { depth = this.depth, width = this.width, height = this.height, mipmaps = false } = opts;
    if (depth !== this.depth || width !== this.width || height !== this.height) {
      this.initialize({
        depth,
        width,
        height,
        mipmaps,
        type: this.type,
        border: this.border,
        format: this.format,
        dataFormat: this.dataFormat,
      });
    }
    return this;
  }

  setImageData(...args: Parameters<LumaTexture3D['setImageData']>) {
    const {
      data,
      level = 0,
      offset = 0,
      parameters = {},
      type = this.type,
      depth = this.depth,
      width = this.width,
      height = this.height,
      border = this.border,
      format = this.format,
      dataFormat = this.dataFormat
    } = args[0];
    texture3DSetImageData.call(this, {
      data, level, type, depth, width, height, border, offset, parameters,
      // luma.gl bug -- these are flipped when passed to gl.texImage3D
      format: dataFormat,
      dataFormat: format,
    });
    return this;
  }
}

(LumaTexture3D.prototype as any).resize = Texture3D.prototype.resize;
(LumaTexture3D.prototype as any).setImageData = Texture3D.prototype.setImageData;
