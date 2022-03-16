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
import { Controls } from './controls';
import { DataCursor, LayoutParams } from '../types';

interface AppProps {
  dataCursor: DataCursor;
  autoCenter: boolean;
  layoutParams: LayoutParams;
  setDataCursor: (cursor: DataCursor) => void;
  setAutoCenter: (autoCenter: boolean) => void;
  setLayoutParams: (layoutParams: LayoutParams) => void;
}

const withAppProps = mapPropsStream<AppProps, {}>((props: any) => {
  const { handler: setDataCursor, stream: dataCursors } = createEventHandler();
  const { handler: setAutoCenter, stream: autoCenters } = createEventHandler();
  const { handler: setLayoutParams, stream: layoutParams } = createEventHandler();

  const props_ = Ix.ai.from<{}>(props as any);

  const dataCursors_ = Ix.ai
    .from<DataCursor>(dataCursors as any)
    .pipe(Ix.ai.ops.startWith('prev' as DataCursor))
    .pipe(Ix.ai.ops.tap((dataCursor: DataCursor) => {
      ipcRenderer.send('dataCursor', dataCursor);
    }));

  const autoCenters_ = Ix.ai
    .from<boolean>(autoCenters as any)
    .pipe(Ix.ai.ops.startWith(true as boolean));

  const layoutParams_ = Ix.ai
    .from<LayoutParams>(layoutParams as any)
    .pipe(Ix.ai.ops.startWith(new LayoutParams({ active: true })))
    .pipe(Ix.ai.ops.tap((layoutParams: LayoutParams) => {
      ipcRenderer.send('layoutParams', layoutParams.toJSON());
    }));

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


export const App = withAppProps(({
  dataCursor,
  autoCenter,
  layoutParams,
  setDataCursor,
  setAutoCenter,
  setLayoutParams,
}: AppProps) => {
  return (
    <>
      <Controls
        dataCursor={dataCursor}
        autoCenter={autoCenter}
        layoutParams={layoutParams}
        style={{ width: '30%', position: 'absolute' }}
        setDataCursor={setDataCursor}
        setAutoCenter={setAutoCenter}
        setLayoutParams={setLayoutParams}
      />
      <Deck
        width='70%'
        height='100%'
        style={{ left: '30%' }}
        autoCenter={autoCenter}
        setAutoCenter={setAutoCenter} />
    </>
  );
});
