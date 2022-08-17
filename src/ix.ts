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

import * as ix_ai from 'ix/asynciterable';
import { sleep } from 'ix/asynciterable/_sleep';
import * as ix_ai_ops from 'ix/asynciterable/operators';
import { MonoTypeOperatorAsyncFunction } from 'ix/interfaces';

export const ai = {
  ...ix_ai,
  sleep,
  ops: {
    ...ix_ai_ops,
    delayEachWithErrorAndComplete: makeDelayEachWithErrorAndComplete(),
  }
};

export { AsyncSink } from 'ix/asynciterable/asyncsink';

function makeDelayEachWithErrorAndComplete() {
  return function delayEachWithErrorAndComplete<TSource>(
    nextDueTime: number, errorDueTime = nextDueTime, completeDueTime = errorDueTime):
    MonoTypeOperatorAsyncFunction<TSource> {
    return function delayEachOperatorFunction(source: AsyncIterable<TSource>) {
      return ix_ai.defer<TSource>(async function* (signal?: AbortSignal) {
        try {
          for await (const item of source) {
            await sleep(nextDueTime, signal);
            yield item;
          }
          await sleep(completeDueTime, signal);
        } catch (e) {
          await sleep(errorDueTime, signal);
          throw e;
        }
      });
    }
  }
}
