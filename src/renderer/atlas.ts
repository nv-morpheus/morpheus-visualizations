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

import { icon } from '@fortawesome/fontawesome-svg-core';
import {
  faImage,
  faVideo,
  faEnvelope,
  faCertificate,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

export interface IconAtlas {
  atlas: ImageData;
  frame: Float32Array;
  offset: Float32Array;
};

export async function loadIcons() {

  const iconWidth = 25;
  const iconHeight = 25;
  const icons = [
    icon(faImage, { styles: { color: '#2b83ba' } }),
    icon(faVideo, { styles: { color: '#abdda4' } }),
    icon(faEnvelope, { styles: { color: '#ffffbf' } }),
    icon(faCertificate, { styles: { color: '#fdae61' } }),
    icon(faExclamationTriangle, { styles: { color: '#d7191c' } }),
  ];
  const aSqrt = Math.ceil(Math.sqrt(icons.length));

  const canvas: HTMLCanvasElement = new ((window as any).OffscreenCanvas)(
    (iconWidth + 2) * aSqrt,
    (iconHeight + 2) * aSqrt
  );

  const context = canvas.getContext('2d');

  const imagePromises = icons
    .map(({ html }, i) => ({
      width: iconWidth - 2,
      height: iconHeight - 2,
      x: 1 + iconWidth * Math.floor(i % aSqrt),
      y: 1 + iconHeight * Math.floor(i / aSqrt),
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(html.flat(Infinity).join(''))}`
    }))
    .map(({ x, y, width, height, src }, i) => {
      const image = new Image(width + 2, height + 2);
      return new Promise<number[]>((resolve, reject) => {
        image.onload = () => {
          image.onload = image.onerror = null;
          context.drawImage(image, x - 1, y - 1, width + 2, height + 2);
          resolve([x, y, width, height]);
        };
        image.onerror = (err) => {
          image.onload = image.onerror = null;
          reject(err);
        };
        image.src = src;
      });
    });

  return await Promise.all(imagePromises).then((frames) => ({
    frame: new Float32Array(frames.flat()),
    atlas: context.getImageData(0, 0, canvas.width, canvas.height),
    offset: new Float32Array(frames.flatMap(([x, y, w, h]) => [w / 2, h / 2])),
  }));
};
