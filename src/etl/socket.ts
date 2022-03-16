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

import * as Ix from '../ix';

export function makeDataSource(serverURL = new URL('ws://localhost:8765'), timeout = 5000) {
  return Ix.ai.defer(makeWebSocket)
    .pipe(
      Ix.ai.ops.delayEachWithErrorAndComplete(0, timeout),
      Ix.ai.ops.scan({
        seed: new Array<Uint8Array>(),
        callback: (bufs, buf) => bufs.concat([buf]),
      }),
      Ix.ai.ops.retry(),
      Ix.ai.ops.repeat(),
    );

  function makeWebSocket() {
    const sink = new Ix.AsyncSink<Uint8Array>();
    const ws   = new WebSocket(serverURL, {
      timeout: timeout,
      handshakeTimeout: timeout,
      perMessageDeflate: false,
      skipUTF8Validation: true,
    });

    const onError   = withDispose((err) => sink.error(err));
    const onClose   = withDispose((code, reason) => sink.end());
    const onMessage = (buf: Buffer) => sink.write(new Uint8Array(buf));
    const onUnexpectedResponse =
      withDispose((_, {statusCode, statusMessage}) =>
                    sink.error(new Error(`Unexpected response (${statusCode}): ${statusMessage}`)));

    ws.on('error', onError)
      .on('close', onClose)
      .on('message', onMessage)
      .on('unexpected-response', onUnexpectedResponse);

    return sink;

    function withDispose<F extends(...args: any[]) => any>(func: F) {
      return function(...args: Parameters<F>) {
        ws.removeListener('error', onError)
          .removeListener('close', onClose)
          .removeListener('message', onMessage)
          .removeListener('unexpected-response', onUnexpectedResponse);
        return func.apply(this, args);
      }
    }
  }
}
