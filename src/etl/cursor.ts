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

import {AsyncIterableX} from 'ix/asynciterable';

import * as Ix from '../ix';
import {DataCursor} from '../types';
import {fromMessagePortEvent} from '../utils';

import {MainProcessChannels, SocketUpdate} from './types';

export function withCursor(channels: MainProcessChannels) {
  return function withCursor(dataSource: AsyncIterableX<{dueTime: number, data: Uint8Array}[]>) {
    const autoSink   = new Ix.AsyncSink<DataCursor>();
    const autoCursor = Ix.ai.from(autoSink);
    const userCursor = Ix.ai.defer(() => {
      const closed = fromMessagePortEvent<void>(channels.cursor, 'close');
      const update = fromMessagePortEvent<DataCursor>(channels.cursor, 'message');
      return Ix.ai.from(update).pipe(
        Ix.ai.ops.startWith('play' as DataCursor),
        Ix.ai.ops.takeUntil(() => Ix.ai.first(closed)),
      );
    });

    const concatWithCursor =
      ({dueTime}: {dueTime: number}, memo: {playing: boolean, cursor: DataCursor}) => {
        return Ix.ai.ops.concatWith<SocketUpdate, SocketUpdate>(Ix.ai.defer(async (signal) => {
          await Ix.ai.sleep(dueTime, signal)
            .then(() => {
              memo.playing = false;
              const cursor = memo.cursor === 'play' ? 'play' : 'stop';
              // console.log(`autoSink.write('${cursor}')`);
              setTimeout(() => autoSink.write(cursor), 0);
            })
            .catch(() => {});
          return Ix.ai.empty();
        }));
      };

    interface CursorAndUpdates {
      count: number;
      index: number;
      cursor: DataCursor;
      playing: boolean;
      updates: null|AsyncIterableX<SocketUpdate>;
    }

    return Ix.ai.merge(userCursor, autoCursor)
      .pipe(Ix.ai.ops.combineLatestWith(dataSource))
      .pipe(Ix.ai.ops.scan({
        seed: <CursorAndUpdates>{
          count: 0,
          index: -1,
          playing: false,
          cursor: 'stop' as DataCursor,
          updates: null as null | AsyncIterableX<SocketUpdate>,
        },
        callback(memo, [cursor, buffer]) {
          let {index, updates} = memo;

          const last         = buffer.length - 1;
          const isDataUpdate = memo.count !== buffer.length;

          const printDueTime = (dueTime: number) => `${(dueTime / 1000).toLocaleString()}s`;
          const logInfo = (index: number) => ({
            cursor,
            index,
            isDataUpdate,
            count: buffer.length,
            dueTime: printDueTime(buffer[index]?.dueTime ?? 0),
            memo: {
              index: memo.index,
              count: memo.count,
              cursor: memo.cursor,
              playing: memo.playing,
            },
          });

          // If currently playing and this event is a new frame from the websocket,
          // don't advance yet. Let the timeout from the previous play event
          // cause the cursor to advance.
          if (index > -1 && isDataUpdate && memo.playing) {
            updates = null;
            // console.log(`skipping update`, logInfo(index));
          } else if (typeof cursor === 'number') {
            index   = Math.max(0, Math.min(cursor, last));
            updates = Ix.ai.of(new SocketUpdate(buffer[index], 'replace', index))
                        .pipe(concatWithCursor(buffer[index], memo));
            // console.log(`advancing to ${index}`, logInfo(index));
            memo.playing = true;
            memo.cursor  = index;
          } else {
            switch (cursor) {
              case 'stop': {
                updates = Ix.ai.never();
                index   = Math.max(0, Math.min(last, index));
                // console.log(`'${cursor}' stopping at ${index}`, logInfo(index));
                memo.playing = false;
                break;
              }
              case 'prev': {
                index   = Math.max(index - 1, 0);
                updates = Ix.ai.of(new SocketUpdate(buffer[index], 'replace', index))
                            .pipe(concatWithCursor(buffer[index], memo));
                // console.log(`'${cursor}' advancing to ${index}`, logInfo(index));
                memo.playing = true;
                cursor       = 'play';
                break;
              }
              case 'next': {
                index   = Math.min(index + 1, last);
                updates = Ix.ai.of(new SocketUpdate(buffer[index], 'append', index))
                            .pipe(concatWithCursor(buffer[index], memo));
                // console.log(`'${cursor}' advancing to ${index}`, logInfo(index));
                memo.playing = true;
                cursor       = 'play';
                break;
              }
              case 'play': {
                if ((index < last) && !memo.playing) {
                  index   = Math.min(index + 1, last);
                  updates = Ix.ai.of(new SocketUpdate(buffer[index], 'append', index))
                              .pipe(concatWithCursor(buffer[index], memo));
                  // console.log(`'${cursor}' advancing to ${index}`, logInfo(index));
                  memo.playing = true;
                  // console.log(`setting cursor to '${cursor}'`);
                } else {
                  updates = null;
                  // console.log(`'${cursor}' deferring to next 'play' cursor`, logInfo(index));
                }
                break;
              }
            }
            memo.cursor = cursor;
          }
          memo.index   = index;
          memo.updates = updates;
          memo.count   = buffer.length;
          return memo;
        }
      }))
      .pipe(Ix.ai.ops.filter(({updates}) => !!updates))
      .pipe(Ix.ai.ops.distinctUntilChanged<CursorAndUpdates, CursorAndUpdates['updates']>({
        keySelector: (next)    => next.updates,
        comparer: (prev, next) => prev == next,
      }))
      .pipe(Ix.ai.ops.switchMap(({updates}) => updates))
      .pipe(Ix.ai.ops.distinctUntilChanged({
        comparer: (x, y) => !(x.kind === 'replace' || x.data !== y.data),
      }));
  }
}
