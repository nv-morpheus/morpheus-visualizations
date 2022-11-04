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

import {parentPort} from 'worker_threads';

import * as Ix from '../ix';
import {dfToArrowIPC} from '../utils';
import {fromMessagePortEvent} from '../utils';

import {withCursor} from './cursor';
import {withShaper} from './shape';
import {makeDataSource} from './socket';
import {MainProcessChannels} from './types';

fromMessagePortEvent<MainProcessChannels>(parentPort, 'message')
  .pipe(Ix.ai.ops.switchMap((channels) => {
    return makeDataSource(channels)()
      .pipe(withCursor(channels))
      .pipe(withShaper(channels))
      .pipe(Ix.ai.ops.map(({nodes, edges, icons, ...rest}) => ({
                            ...rest,
                            nodes: dfToArrowIPC(nodes),
                            edges: dfToArrowIPC(edges),
                            icons: dfToArrowIPC(icons),
                          })));
  }))
  .pipe(Ix.ai.ops.tap({error: (err) => console.error('error in ETL thread:', err)}))
  .forEach(({channels, kind, index, dueTime, nodes, edges, icons}) => {
    channels.update.postMessage({kind, index, dueTime, nodes, edges, icons},
                                [nodes.buffer, edges.buffer, icons.buffer]);
  })
  .catch((err) => console.error('error in ETL thread:', err));
