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

import {MessagePort} from 'worker_threads';

const agefactor        = parseFloat(process.env.AGE_FACTOR ?? '500.0');
export const ageFactor = isNaN(agefactor) ? 500 : agefactor;

export interface MainProcessChannels {
  cursor: MessagePort;
  frames: MessagePort;
  update: MessagePort;
}

export class SocketUpdate {
  public data: Uint8Array;
  public dueTime: number;
  public kind: 'append'|'replace';
  public index: number;
  constructor(
    {dueTime, data}: {dueTime: number, data: Uint8Array},
    kind: 'append'|'replace',
    index: number,
  ) {
    this.data    = data;
    this.dueTime = dueTime;
    this.kind    = kind;
    this.index   = index;
  }
}

export interface ShapedUpdate {
  index: number;
  dueTime: number;
  kind: 'replace'|'append';
  nodes: Uint8Array;
  edges: Uint8Array;
  icons: Uint8Array;
}
