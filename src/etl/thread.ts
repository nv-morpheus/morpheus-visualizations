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

import {DataFrame, Series} from '@rapidsai/cudf';
import {AsyncIterableX} from 'ix/asynciterable';
import {MessagePort, parentPort} from 'worker_threads';

import * as Ix from '../ix';
import {DataCursor, PreshapedEdges} from '../types';

import {shape} from './shape';
import {makeDataSource} from './socket';

interface MainProcessChannels {
  cursor: MessagePort;
  frames: MessagePort;
  update: MessagePort;
}

const rateLimit = 100;

class Update {
  constructor(
    public data: Uint8Array,
    public kind: 'append'|'replace',
    public index: number,
  ) {}
}

fromEvent<MainProcessChannels>(parentPort, 'message')
  .pipe(Ix.ai.ops.switchMap((channels) => {
    const autoSink   = new Ix.AsyncSink<DataCursor>();
    const autoCursor = Ix.ai.from(autoSink);
    const userCursor = Ix.ai.defer(() => {
      const closed = fromEvent<void>(channels.cursor, 'close');
      const update = fromEvent<DataCursor>(channels.cursor, 'message');
      return Ix.ai.from(update).pipe(
        Ix.ai.ops.startWith('prev' as DataCursor),
        Ix.ai.ops.takeUntil(() => Ix.ai.first(closed)),
      );
    });

    const dataSource = makeDataSource()  //
                         .pipe(Ix.ai.ops.throttle(10))
                         .pipe(Ix.ai.ops.tap((buffer) => {  //
                           channels.frames.postMessage({count: buffer.length});
                         }));

    return Ix.ai.merge(userCursor, autoCursor)
      .pipe(Ix.ai.ops.combineLatestWith(dataSource))
      .pipe(Ix.ai.ops.scan({seed: cursorSeed(), callback: makeCursorScanSelector(autoSink)}))
      .pipe(Ix.ai.ops.switchMap(({updates}) => updates))
      .pipe(Ix.ai.ops.distinctUntilChanged({
        comparer: (x, y) => !(x.kind === 'replace' || x.data !== y.data),
      }))
      .pipe(Ix.ai.ops.scan({seed: shaperSeed(), callback: shaperScanSelector}))
      .pipe(Ix.ai.ops.map((update) => ({channels, ...update})));
  }))
  .forEach(({channels, shaped, kind, index}) => {
    const nodes = shaped.nodes.toArrow().serialize();
    const edges = shaped.edges.toArrow().serialize();
    const icons = shaped.icons.toArrow().serialize();
    channels.update.postMessage({kind, index, nodes, edges, icons},
                                [nodes.buffer, edges.buffer, icons.buffer]);
  })
  .catch((err) => { console.error('thread error:', err); });

function fromEvent<T>(port: MessagePort, type: string) {
  return Ix.ai.fromEventPattern<T>((h) => port.on(type, h), (h) => port.off(type, h));
}

function makeCursorScanSelector(autoSink: Ix.AsyncSink<DataCursor>) {
  return function cursorScanSelector(memo: ReturnType<typeof cursorSeed>,
                                     [cursor, buffer]: [DataCursor, Uint8Array[]]) {
    const curr   = memo.index;
    const last   = buffer.length - 1;
    const prev   = Math.max(curr - 1, 0);
    const next   = Math.min(curr + 1, last);
    memo.updates = Ix.ai.never() as AsyncIterableX<Update>;
    switch (cursor) {
      case 'stop': break;
      case 'prev':
        memo.index   = prev;
        memo.updates = Ix.ai
                         .of(new Update(buffer[prev], 'replace', prev))  //
                         .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
        break;
      case 'next':
        memo.index   = next;
        memo.updates = Ix.ai
                         .of(new Update(buffer[next], 'append', next))  //
                         .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
        break;
      case 'play':
        if (curr < next) {
          memo.index   = next;
          memo.updates = Ix.ai.of(new Update(buffer[next], 'append', next))
                           .pipe(Ix.ai.ops.concatWith(Ix.ai.defer(async (signal) => {
                             await Ix.ai.sleep(rateLimit, signal);
                             autoSink.write('play');
                             return Ix.ai.never();
                           })));
        }
        break;
      default:
        if (typeof cursor === 'number') {
          cursor       = Math.max(0, Math.min(last, cursor));
          memo.index   = cursor;
          memo.updates = Ix.ai.of(new Update(buffer[cursor], 'replace', cursor))
                           .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
          // if (cursor < curr) {
          //     memo.index   = cursor;
          //     memo.updates = Ix.ai.of(new Update(buffer[cursor], 'replace', cursor))
          //                      .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
          //   } else {
          //     memo.updates =
          //       Ix.ai.from(buffer.slice(curr, cursor))
          //         .pipe(Ix.ai.ops.map((value, offset) => {
          //           return new Update(value, 'append', memo.index = curr + offset);
          //         }))
          //         .pipe(Ix.ai.ops.tap({complete: () => autoSink.write('stop')}));
          //   }
        }
        break;
    }
    return memo;
  }
}

function cursorSeed() {
  return {
    index: 0,
    updates: Ix.ai.of(new Update(new Uint8Array(), 'append', 0)),
  };
}

function shaperScanSelector({oldEdges}: ReturnType<typeof shaperSeed>,
                            {kind, index, data}: Update) {
  const newEdges = DataFrame.fromArrow<PreshapedEdges>(data);
  const {oldEdges: oldEdges_, ...shaped} =
    kind === 'replace' ? shape(newEdges) : shape(oldEdges, oldEdges.concat(newEdges));
  return {
    kind,
    index,
    shaped,
    oldEdges: oldEdges_,
  };
}

function shaperSeed() {
  return {
    index: 0,
    kind: 'replace',
    oldEdges: new DataFrame({
      src: Series.new(new Int32Array()),
      dst: Series.new(new Int32Array()),
      lvl: Series.new(new Int32Array()),
    }),
    shaped: {
      nodes: new DataFrame({
        id: Series.new(new Int32Array()),
        size: Series.new(new Uint8Array()),
        color: Series.new(new Uint32Array()),
      }),
      edges: new DataFrame({
        id: Series.new(new Int32Array()),
        src: Series.new(new Int32Array()),
        dst: Series.new(new Int32Array()),
        color: Series.new(new BigUint64Array()),
        edge: Series.new(new BigUint64Array()),
        bundle: Series.new(new BigUint64Array()),
      }),
      icons: new DataFrame({
        id: Series.new(new Int32Array()),
        edge: Series.new(new Int32Array()),
        icon: Series.new(new Int32Array()),
        age: Series.new(new Float32Array()),
      }),
    }
  };
}
