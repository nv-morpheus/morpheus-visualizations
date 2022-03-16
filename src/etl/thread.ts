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
  update: MessagePort;
}

const rateLimit = 100;

class Update {
  constructor(
    public data: Uint8Array,
    public kind: 'append'|'replace',
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

    const dataSource = makeDataSource().pipe(Ix.ai.ops.throttle(rateLimit));

    return Ix.ai.merge(userCursor, autoCursor)
      .pipe(Ix.ai.ops.combineLatestWith(dataSource))
      .pipe(Ix.ai.ops.scan({seed: cursorSeed(), callback: makeCursorScanSelector(autoSink)}))
      .pipe(Ix.ai.ops.switchMap(({updates}) => updates))
      .pipe(Ix.ai.ops.distinctUntilChanged({
        comparer: (x, y) => !(x.kind === 'replace' || x.data !== y.data),
      }))
      .pipe(Ix.ai.ops.scan({seed: shaperSeed(), callback: shaperScanSelector}))
      .pipe(Ix.ai.ops.map(({kind, shaped}) => ({channels, kind, shaped})));
  }))
  .forEach(({channels, kind, shaped}) => {
    const nodes = shaped.nodes.toArrow().serialize();
    const edges = shaped.edges.toArrow().serialize();
    const icons = shaped.icons.toArrow().serialize();
    channels.update.postMessage({kind, nodes, edges, icons},
                                [nodes.buffer, edges.buffer, icons.buffer]);
  })
  .catch((err) => { console.error('thread error:', err); });

function fromEvent<T>(port: MessagePort, type: string) {
  return Ix.ai.fromEventPattern<T>((h) => port.on(type, h), (h) => port.off(type, h));
}

function makeCursorScanSelector(autoSink: Ix.AsyncSink<DataCursor>) {
  return function cursorScanSelector({index}: ReturnType<typeof cursorSeed>,
                                     [cursor, buffer]: [DataCursor, Uint8Array[]]) {
    const prev  = Math.max(index - 1, 0);
    const next  = Math.min(index + 1, buffer.length - 1);
    let updates = Ix.ai.never() as AsyncIterableX<Update>;
    switch (cursor) {
      case 'prev':
        updates = Ix.ai.of(new Update(buffer[index = prev], 'replace'))
                    .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
        break;
      case 'next':
        updates = Ix.ai.of(new Update(buffer[index = next], 'append'))
                    .pipe(Ix.ai.ops.tap(() => autoSink.write('stop')));
        break;
      case 'play':
        if (index < next) {
          updates = Ix.ai.of(new Update(buffer[index = next], 'append'))
                      .pipe(Ix.ai.ops.map(async (update, _, signal) => {
                        await Ix.ai.sleep(rateLimit, signal);
                        autoSink.write('play');
                        return update;
                      }));
        }
        break;
    }
    return {index, updates};
  }
}

function cursorSeed() {
  return {
    index: 0,
    updates: Ix.ai.of(new Update(new Uint8Array(), 'append')),
  };
}

function shaperScanSelector({oldEdges}: ReturnType<typeof shaperSeed>, {data, kind}: Update) {
  const newEdges = DataFrame.fromArrow<PreshapedEdges>(data);
  const {oldEdges: oldEdges_, ...shaped} =
    kind === 'replace' ? shape(newEdges) : shape(oldEdges, oldEdges.concat(newEdges));
  return {
    kind,
    shaped,
    oldEdges: oldEdges_,
  };
}

function shaperSeed() {
  return {
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
