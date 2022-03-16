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

import { LayoutParams, RenderMessage } from '../types';
import {
  defer as asyncIterableDefer,
  fromEventPattern as asyncIterableFromEventPattern,
} from 'ix/asynciterable';
import {
  scan as scanAsyncIterable
} from 'ix/asynciterable/operators';

import { loadIcons } from './atlas';
import { RenderState } from './types';
import { init as initDeck, update as updateDeck } from './app';

const { ipcRenderer } = window.require('electron');
const updates = asyncIterableDefer(() => {
  ipcRenderer.send('renderComplete', {});

  let handler: (_: any, state: RenderMessage) => void;

  return asyncIterableFromEventPattern<RenderMessage>(
    (h) => {
      handler = (_, state: RenderMessage) => h(state);
      ipcRenderer.addListener('render', handler);
    },
    (_) => {
      ipcRenderer.removeListener('render', handler);
      handler = null;
    }
  )
});


initDeck().then(async (appState) => {
  ipcRenderer.send('layoutParams', new LayoutParams().toJSON());
  return updates
    .pipe(scanAsyncIterable({
      seed: new RenderState(appState.gl.canvas, appState.gl).copyIconAtlas(await loadIcons()),
      callback: copyRenderState
    }))
    .pipe(scanAsyncIterable({ seed: appState, callback: updateDeck }))
    .forEach(() => { })
}).catch((e) => {
  console.error(e);
});

function copyRenderState(renderState: RenderState, renderMessage: RenderMessage) {
  if (renderMessage.node.changed
    || (renderState.node.length !== renderMessage.node.id.length)
  ) {
    renderState.copyNodeBuffers(renderMessage);
  }
  if (renderMessage.edge.changed
    || (renderState.edge.length !== renderMessage.edge.id.length)
  ) {
    renderState.copyEdgeBuffers(renderMessage);
  }
  if (renderMessage.icon.changed
    || (renderState.icon.length !== renderMessage.icon.age.length)
  ) {
    renderState.copyIconBuffers(renderMessage);
  }
  renderState.copyDynamicBuffers(renderMessage);
  ipcRenderer.send('renderComplete', renderMessage);
  return renderState;
}
