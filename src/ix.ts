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

// import * as ix_i from 'ix/iterable';
// import * as ix_i_ops from 'ix/iterable/operators';

// export const i = {
//   ...ix_i,
//   ops: ix_i_ops
// };

import * as ix_ai from 'ix/asynciterable';
import {sleep} from 'ix/asynciterable/_sleep';
import * as ix_ai_ops from 'ix/asynciterable/operators';

export const ai = {
  ...ix_ai,
  sleep,
  ops: {
    ...ix_ai_ops,
    switchMap: makeSwitchMap(),
    delayEachWithErrorAndComplete: makeDelayEachWithErrorAndComplete(),
  }
};

export {AsyncSink} from 'ix/asynciterable/asyncsink';

import {OperatorAsyncFunction, MonoTypeOperatorAsyncFunction} from 'ix/interfaces';
import {AbortError, throwIfAborted} from 'ix/aborterror';
import {safeRace} from 'ix/util/safeRace';

function makeDelayEachWithErrorAndComplete() {
  return function delayEachWithErrorAndComplete<TSource>(
    nextDueTime: number, errorDueTime = nextDueTime, completeDueTime = errorDueTime):
    MonoTypeOperatorAsyncFunction<TSource> {
    return function delayEachOperatorFunction(source: AsyncIterable<TSource>) {
      return ix_ai.defer<TSource>(async function*(signal?: AbortSignal) {
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

function makeSwitchMap() {
  type ExtractValueType<A> = A extends AsyncIterable<infer T>? T : never;
  type SwitchMapSelector<TSource, TResult extends AsyncIterable<any>> =
    (value: TSource, index: number, signal?: AbortSignal) => TResult|Promise<TResult>;

  const NEVER_PROMISE = new Promise<IteratorResult<never>>(() => {});

  class SwitchMapAsyncIterable<TSource, TResult extends AsyncIterable<any>> extends
    ix_ai.AsyncIterableX<ExtractValueType<TResult>> {
    constructor(private source: AsyncIterable<TSource>,
                private selector: SwitchMapSelector<TSource, TResult>,
                private thisArg?: any) {
      super();
    }
    async * [Symbol.asyncIterator](signal?: AbortSignal) {
      throwIfAborted(signal);

      const enum Type
      {
        OUTER = -1,
        INNER = 0,
      }

      type OuterWrap = { value: TSource; type: Type.OUTER };
      type InnerWrap = { value: ExtractValueType<TResult>; type: Type.INNER };

      async function*
        wrapIterator(source: AsyncIterable<TSource>|TResult, type: Type, signal?: AbortSignal) {
        for await (const value of ix_ai_ops.wrapWithAbort(source, signal)) {
          throwIfAborted(signal);
          yield {type, value};
        }
        return {type, value: undefined as any};
      }

      function swallowOurAbortErrors(innerSignal: AbortSignal) {
        return function(e?: any) {
          if (e instanceof AbortError && !innerSignal.aborted) { throw e; }
          return NEVER_PROMISE;
        };
      }

      let index = 0;
      let controller: AbortController|undefined;
      let catchOurAborts: (e?: any) => any = (e) => { throw e; };
      const outer                                = wrapIterator(this.source, Type.OUTER, signal);
      let inner: AsyncIterableIterator<OuterWrap|InnerWrap>|undefined;

      const pending = {
        [Type.OUTER]: outer.next(),
        [Type.INNER]: NEVER_PROMISE as Promise<IteratorResult<OuterWrap|InnerWrap>>,
        * [Symbol.iterator]() {
            yield pending[Type.OUTER];
            yield pending[Type.INNER];
          },
      };

      while (1) {
        const {
          done = false,
          value: {type, value},
        } =
          await safeRace([...pending]);

        if (done) {
          // only listen for one of the next results
          pending[type] = NEVER_PROMISE;
          // exit if both inner and outer are done
          if (pending[~type as Type] === NEVER_PROMISE) { break; }
        } else {
          if (type === Type.OUTER) {
            // abort the current inner iterator first
            controller && controller.abort();
            controller     = new AbortController();
            catchOurAborts = swallowOurAbortErrors(controller.signal);
            inner          = wrapIterator(
              await this.selector.call(this.thisArg, value, index++, controller.signal),
              Type.INNER,
              controller.signal);
            pending[Type.OUTER] = outer.next();
          } else if (type === Type.INNER) {
            yield value;
          }
          pending[Type.INNER] = inner!.next().catch(catchOurAborts);
        }
      }
    }
  }

  return function switchMap<TSource extends unknown, TResult extends AsyncIterable<any>>(
    selector: SwitchMapSelector<TSource, TResult>,
    thisArg?: any): OperatorAsyncFunction<TSource, ExtractValueType<TResult>> {
    return function switchMapOperatorFunction(source) {  //
      return new SwitchMapAsyncIterable(source, selector, thisArg);
    }
  }
}
