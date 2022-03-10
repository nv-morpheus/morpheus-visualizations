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

import WebSocket from 'ws';
import { AsyncSink } from 'ix/Ix.node';
import { AsyncIterable as AsyncIterableX } from 'ix/Ix.node';
import { repeat, retry, timeout } from 'ix/asynciterable/operators';

class Message {
  constructor(
    public type: 'replace' | 'append',
    public edges: Uint8Array) { }
}

const timeoutTime = 5000;

export function dataSource(prev: AsyncIterable<void>, next: AsyncIterable<void>) {
  return getSocketDataSource().pipe(
    delayEach(1000, timeoutTime),
    timeout(timeoutTime * 2),
    retry(),
    repeat()
  );
}

function getSocketDataSource() {
  return AsyncIterableX.defer(() => {
    const sink = new AsyncSink<Message>();
    const sock = new WebSocket('ws://localhost:8765', {
      timeout: timeoutTime,
      handshakeTimeout: timeoutTime,
      perMessageDeflate: false,
      skipUTF8Validation: true,
    });

    sock.on('open', onOpen);
    sock.on('error', onError);
    sock.on('close', onClose);
    sock.on('unexpected-response', onUnexpectedResponse);

    return sink;

    function onOpen() {
      sock.on('message', onMessage);
    }

    function onError(err: Error) {
      sock.off('open', onOpen);
      sock.off('error', onError);
      sock.off('close', onClose);
      sock.off('message', onMessage);
      sock.off('unexpected-response', onUnexpectedResponse);
      sink.error(err);
    }

    function onClose(code: number, reason: Buffer) {
      sock.off('open', onOpen);
      sock.off('error', onError);
      sock.off('close', onClose);
      sock.off('message', onMessage);
      sock.off('unexpected-response', onUnexpectedResponse);
      sink.end();
    }

    function onMessage(data: Buffer, isBinary: boolean) {
      if (isBinary) {
        try {
          sink.write(new Message('append', new Uint8Array(data)));
        } catch (e) { console.error(e); }
      }
    }

    function onUnexpectedResponse(req: import('http').ClientRequest, res: import('http').IncomingMessage) {
      onError(new Error(`Unexpected response (${res.statusCode}): ${res.statusMessage}`));
    }
  });
}

import { MonoTypeOperatorAsyncFunction } from 'ix/interfaces';
import { sleep } from 'ix/asynciterable/_sleep';

function delayEach<TSource>(nextDueTime: number, errorDueTime = nextDueTime, completeDueTime = errorDueTime): MonoTypeOperatorAsyncFunction<TSource> {
  return function delayEachOperatorFunction(source: AsyncIterable<TSource>) {
    return AsyncIterableX.defer<TSource>(async function* () {
      try {
        for await (const item of source) {
          await sleep(nextDueTime);
          yield item;
        }
        await sleep(completeDueTime);
      } catch (e) {
        await sleep(errorDueTime);
        throw e;
      }
    });
  }
}
