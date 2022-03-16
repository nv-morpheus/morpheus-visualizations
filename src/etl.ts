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

import {MessageChannel, Worker} from 'worker_threads';

export function makeETLWorker() {
  const worker = new Worker(new URL('./etl/thread.ts', import.meta.url));
  worker.on('error', (err) => { console.error(`worker error:`, err); });
  worker.on('exit', (code) => {
    if (code !== 0) { console.error(`Worker stopped with exit code ${code}`); }
  });
  const cursor = new MessageChannel();
  const update = new MessageChannel();
  worker.once('online', () => {
    worker.postMessage(
      {cursor: cursor.port1, update: update.port1},
      [cursor.port1, update.port1],
    );
  });
  return {
    worker,
    cursor,
    update,
  };
}
