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

import * as Ix from '../ix';
import * as React from 'react';
import { mapPropsStream, createEventHandler } from 'recompose';

const { ipcRenderer } = window.require('electron');

import { Deck } from './deck';
import { loadIcons } from './atlas';
import { Controls } from './controls';
import { RenderState } from './types';
import { DataCursor, LayoutParams, RenderMessage } from '../types';

export interface AppProps {
  dataCursor: DataCursor;
  autoCenter: boolean;
  layoutParams: LayoutParams;
  setDataCursor: (cursor: DataCursor) => void;
  setAutoCenter: (autoCenter: boolean) => void;
  setLayoutParams: (layoutParams: LayoutParams) => void;
}

export interface RendererProps {
  dataCursorIndex: number;
  dataFramesCount: number;
  renderState: RenderState;
  setGLContext: (gl: WebGL2RenderingContext) => void;
}

const withAppProps = mapPropsStream<AppProps, {}>((props: any) => {
  const { handler: setDataCursor, stream: dataCursors } = createEventHandler();
  const { handler: setAutoCenter, stream: autoCenters } = createEventHandler();
  const { handler: setLayoutParams, stream: layoutParams } = createEventHandler();

  const props_ = Ix.ai.from<{}>(props as any);

  const dataCursors_ = Ix.ai
    .from<DataCursor>(dataCursors as any)
    .pipe(Ix.ai.ops.tap((dataCursor: DataCursor) => {
      ipcRenderer.send('dataCursor', dataCursor);
    }))
    .pipe(Ix.ai.ops.startWith('play' as DataCursor));

  const autoCenters_ = Ix.ai
    .from<boolean>(autoCenters as any)
    .pipe(Ix.ai.ops.startWith(true as boolean));

  const layoutParams_ = Ix.ai
    .from<LayoutParams>(layoutParams as any)
    .pipe(Ix.ai.ops.tap((layoutParams: LayoutParams) => {
      ipcRenderer.send('layoutParams', layoutParams.toJSON());
    }))
    .pipe(Ix.ai.ops.startWith(new LayoutParams({ active: true })));

  return Ix.ai
    .combineLatest(props_, dataCursors_, autoCenters_, layoutParams_)
    .pipe(Ix.ai.ops.map(([props, dataCursor, autoCenter, layoutParams]) => {
      return {
        ...props,
        dataCursor,
        autoCenter,
        layoutParams,
        setDataCursor,
        setAutoCenter,
        setLayoutParams,
      };
    }))
    .pipe(Ix.ai.toObservable);
});

const withRenderState = mapPropsStream<AppProps & RendererProps, AppProps>((props) => {
  const { handler: setGLContext, stream: glContexts } = createEventHandler();

  const props_ = Ix.ai.from<AppProps>(props as any);

  const contexts_ = Ix.ai.from<WebGL2RenderingContext>(glContexts as any)
    .pipe(Ix.ai.ops.startWith(null as WebGL2RenderingContext));

  const messages_ = renderMessages().pipe(Ix.ai.ops.startWith(null as RenderMessage));

  return Ix.ai
    .combineLatest(props_, contexts_, messages_)
    .pipe(Ix.ai.ops.scan({
      seed: undefined as AppProps & RendererProps,
      async callback({ renderState } = {} as any, [props, gl, renderMessage]) {
        let dataCursorIndex = 0;
        let dataFramesCount = 0;
        if (renderMessage) {
          dataCursorIndex = renderMessage.index;
          dataFramesCount = renderMessage.count;
          if (gl) {
            renderState ??= new RenderState(gl.canvas, gl).copyIconAtlas(await loadIcons());
            renderState = renderState.copyRenderMessage(renderMessage);
          }
        }
        ipcRenderer.send('renderComplete', {});
        if (typeof props.dataCursor === 'number') {
          dataCursorIndex = props.dataCursor;
        }

        return {
          ...props,
          renderState,
          setGLContext,
          dataCursorIndex,
          dataFramesCount,
        };
      }
    }))
    .pipe(Ix.ai.toObservable);
});

export const App = withAppProps(withRenderState(({
  dataCursor,
  autoCenter,
  layoutParams,
  renderState,
  setGLContext,
  setDataCursor,
  setAutoCenter,
  setLayoutParams,
  dataCursorIndex,
  dataFramesCount,
}) => {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'stretch', flexDirection: 'row', flexWrap: 'nowrap' }}>
      <Controls
        style={{ backgroundColor: 'transparent', zIndex: 2, minWidth: 320 }}
        dataCursor={dataCursor}
        autoCenter={autoCenter}
        layoutParams={layoutParams}
        setDataCursor={setDataCursor}
        setAutoCenter={setAutoCenter}
        setLayoutParams={setLayoutParams}
        dataCursorIndex={dataCursorIndex}
        dataFramesCount={dataFramesCount}
      />
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Deck
          autoCenter={autoCenter}
          renderState={renderState}
          setAutoCenter={setAutoCenter}
          onWebGLInitialized={setGLContext} />
      </div>
    </div>
  );
}));

function renderMessages() {
  let handler: (_: any, state: RenderMessage) => void;
  return Ix.ai.fromEventPattern<RenderMessage>(
    (h) => {
      handler = (_, state: RenderMessage) => h(state);
      ipcRenderer.addListener('render', handler);
    },
    (_) => {
      ipcRenderer.removeListener('render', handler);
      handler = null;
    }
  );
}
