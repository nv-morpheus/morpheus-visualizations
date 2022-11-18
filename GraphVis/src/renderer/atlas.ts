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

import {icon} from '@fortawesome/fontawesome-svg-core';
import {faCircle as level0Icon} from '@fortawesome/free-solid-svg-icons';
// import { faEnvelope as level0Icon } from '@fortawesome/free-solid-svg-icons';
// import { faPaperPlane as level0Icon } from '@fortawesome/free-solid-svg-icons';
import {faExclamationTriangle as level1Icon} from '@fortawesome/free-solid-svg-icons';
import {faImage as level2Icon} from '@fortawesome/free-solid-svg-icons';
import {faVideo as level3Icon} from '@fortawesome/free-solid-svg-icons';
import {faCertificate as level4Icon} from '@fortawesome/free-solid-svg-icons';

export interface IconAtlas {
  atlas: ImageData;
  frame: Float32Array;
  offset: Float32Array;
}

export async function loadIcons() {
  const iconWidth  = 25;
  const iconHeight = 25;
  const icons      = [
    icon(level0Icon, {
      styles: {
        /* color: '#ffffbf', */
        /* color: 'rgba(255, 255, 191, 0.25)' */
        color: 'rgba(255, 255, 255, 0.25)',
      },
      //  transform: {size: 5},
      transform: {size: 10},
    }),
    icon(level1Icon, {
      styles: {
        /* color: '#d7191c', */
        color: 'rgba(215, 25, 28, 0.75)',
      },
      transform: {size: 15},
    }),
    icon(level2Icon, {
      styles: {
        color: '#2b83ba',
      }
    }),
    icon(level3Icon, {
      styles: {
        color: '#abdda4',
      }
    }),
    icon(level4Icon, {
      styles: {
        color: '#fdae61',
      }
    }),
  ];
  const aSqrt = Math.ceil(Math.sqrt(icons.length));

  const canvas: HTMLCanvasElement =
    new ((window as any).OffscreenCanvas)((iconWidth + 2) * aSqrt, (iconHeight + 2) * aSqrt);

  const context = canvas.getContext('2d');

  const imagePromises = icons
                          .map(({html}, i) => ({
                                 width: iconWidth - 2,
                                 height: iconHeight - 2,
                                 x: 1 + iconWidth * Math.floor(i % aSqrt),
                                 y: 1 + iconHeight * Math.floor(i / aSqrt),
                                 src: `data:image/svg+xml;charset=utf-8,${
                                   encodeURIComponent(html.flat(Infinity).join(''))}`
                               }))
                          .map(({x, y, width, height, src}, i) => {
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

  return await Promise.all(imagePromises)
    .then((frames) => ({
            frame: new Float32Array(frames.flat()),
            atlas: context.getImageData(0, 0, canvas.width, canvas.height),
            offset: new Float32Array(frames.flatMap(([x, y, w, h]) => [w / 2, h / 2])),
          }));
};
