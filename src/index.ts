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

import {app, BrowserWindow, ipcMain} from 'electron';

// This allows TypeScript to pick up the magic constant that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'NVIDIA Morpheus',
    height: 768,
    width: 1280,
    show: true,
    skipTaskbar: false,
    backgroundColor: '#1A1918',
    paintWhenInitiallyHidden: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInWorker: true,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.once('dom-ready', () => onDOMReady(mainWindow));
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
});

// // In this file you can include the rest of your app's specific main process
// // code. You can also put them in separate files and import them here.

import {MessagePort} from 'worker_threads';

import {initializeDefaultPoolMemoryResource} from './rmm';

initializeDefaultPoolMemoryResource(
  2 * (1024 ** 3),  // 2GiB
  4 * (1024 ** 3),  // 4GiB
);

import {Series} from '@rapidsai/cudf';
Series.new([0, 1, 2]).sum();

import {makeETLWorker} from './etl';
import {layout} from './etl/layout';
import * as Ix from './ix';

import {DataCursor, HostBuffers, LayoutParams} from './types';

const dataCursors  = new Ix.AsyncSink<DataCursor>();
const layoutParams = new Ix.AsyncSink<LayoutParams>();

ipcMain.on('dataCursor', (_, xs) => { dataCursors.write(xs); });
ipcMain.on('layoutParams', (_, xs) => { layoutParams.write(new LayoutParams(xs)); });

function onDOMReady(mainWindow: BrowserWindow) {
  const {worker, cursor, frames, update} = makeETLWorker();

  worker.once('online', () => {
    Ix.ai.from(dataCursors).forEach((xs) => cursor.port2.postMessage(xs));

    const updates = fromMessagePortEvent<{
      index: number,
      kind: 'replace' | 'append',
      nodes: Uint8Array,
      edges: Uint8Array,
      icons: Uint8Array
    }>(update.port2, 'message');

    const layoutUpdates =
      layout(updates, layoutParams)
        .pipe(Ix.ai.ops.startWith(
          {index: 0, kind: 'replace', bbox: [NaN, NaN, NaN, NaN], ...new HostBuffers()}));

    const frameCounts = fromMessagePortEvent<{count: number}>(frames.port2, 'message')
                          .pipe(Ix.ai.ops.startWith({count: 0} as {count: number}));

    layoutUpdates.pipe(Ix.ai.ops.combineLatestWith(frameCounts))
      .forEach(async ([{index, edge, icon, node, bbox}, {count}]) => {
        const done = new Promise((r) => ipcMain.once('renderComplete', r));
        mainWindow.webContents.send('render', {edge, icon, node, bbox, index, count});
        await done;
      })
      .catch((e) => { console.error('layout error', e); });
  });
}

function fromMessagePortEvent<T>(port: MessagePort, type: string) {
  return Ix.ai.fromEventPattern<T>((h) => port.on(type, h), (h) => port.off(type, h));
}
