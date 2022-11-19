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
import {PreshapedEdges} from '../types';
import {maxIconAge} from '../types';
import {fromArrow} from '../utils';

import {ageFactor, MainProcessChannels} from './types';

interface Frame {
  data: Uint8Array;
  dueTime: number;
}

function getFrame(data: Uint8Array) {
  const df      = fromArrow<PreshapedEdges>(data);
  const dueTime = (df.get('dt').max(true) / ageFactor) + (maxIconAge * 0.5);
  // console.log({numRows: df.numRows, dueTime}, df.types);
  return {
    data,
    dueTime,
    types: df.types,
    names: df.names,
    numRows: df.numRows,
    numColumns: df.numColumns,
  };
}

export function makeDataSource(channels: MainProcessChannels) {
  return function makeDataSource(serverURL = new URL('ws://' + (process.env.MORPHEUS_SOCKET_URL || 'localhost:8765')), timeout = 5000) {
    return Ix.ai.defer(withWebSocket(channels, serverURL, timeout))
      .pipe(
        Ix.ai.ops.delayEachWithErrorAndComplete(0, timeout),
        Ix.ai.ops.scan({
          seed: new Array<Frame>(),
          callback: (bufs, update) => bufs.concat(update),
        }),
        Ix.ai.ops.retry(),
        Ix.ai.ops.repeat(),
      );
  }

  function withWebSocket(channels: MainProcessChannels, serverURL: URL, timeout: number) {
    return function makeWebSocket() {
      let count  = 0;
      const sink = new Ix.AsyncSink<Frame>();
      const ws   = new WebSocket(serverURL, {
        timeout: timeout,
        handshakeTimeout: timeout,
        perMessageDeflate: false,
        skipUTF8Validation: true,
      });

      const onError   = withDispose((err) => sink.error(err));
      const onClose   = withDispose((code, reason) => sink.end());
      const onMessage = (buf: WebSocket.RawData, isBinary: boolean) => {
        if (isBinary) {
          let frame: Frame;
          try {
            frame = getFrame(new Uint8Array(Buffer.isBuffer(buf) || (buf instanceof ArrayBuffer)
                                              ? buf.slice(0)
                                              : Buffer.concat(buf).buffer));
          } catch { return; }
          channels.frames.postMessage({count: ++count});
          setImmediate(() => sink.write(frame));
        }
      };
      const onUnexpectedResponse =
        withDispose((_, {statusCode, statusMessage}) => sink.error(
                      new Error(`Unexpected response (${statusCode}): ${statusMessage}`)));

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
}
