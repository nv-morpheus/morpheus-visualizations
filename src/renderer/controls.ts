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
  faPlay,
  faPause,
  faForward,
  faBackward,
} from '@fortawesome/free-solid-svg-icons';

import { LayoutParams } from '../types';

const icons = {
  play: icon(faPlay),
  pause: icon(faPause),
  next: icon(faForward),
  prev: icon(faBackward),
};

export function initControls(ipc: Electron.IpcRenderer) {

  const params = new LayoutParams();

  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const play = document.getElementById('play');

  prev.appendChild(icons.prev.node[0]);
  next.appendChild(icons.next.node[0]);
  play.appendChild(icons.pause.node[0]);

  play.addEventListener('click', withNewLayoutParams(() => {
    params.active = !params.active;
    play.removeChild(play.children[0]);
    play.appendChild(params.active ? icons.pause.node[0] : icons.play.node[0]);
  }));

  function withNewLayoutParams<F extends (...args: any[]) => any>(fn: F) {
    return function (...args: Parameters<F>) {
      fn(...args);
      ipc.send('layoutParams', params.toJSON());
    }
  }

  ipc.send('layoutParams', params.toJSON());
}
