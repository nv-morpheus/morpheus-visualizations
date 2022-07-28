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

import {MemoryData} from '@rapidsai/cuda';
import {ColumnsMap, DataFrame, DataType, Table, ToArrowMetadata, TypeMap} from '@rapidsai/cudf';
import {DeviceBuffer} from '@rapidsai/rmm';
import * as arrow from 'apache-arrow';
import {MessagePort} from 'worker_threads';

import * as Ix from './ix';

const logRunTimes = (() => {
  switch (process.env.LOG_RUN_TIMES) {
    case '':
    case '0':
    case 'false':
    case undefined: return false;
    default: return true;
  }
})();

export function logRuntime<F extends(...args: any[]) => any>(fn: F): F {
  if (!logRunTimes) {
    return ((...args: Parameters<F>) => fn(...args)) as F;
  } else {
    return ((...args: Parameters<F>) => {
             console.time(fn.name);
             const r = fn(...args);
             console.timeEnd(fn.name);
             return r;
           }) as F;
  }
}

export function dfToArrowIPC<T extends TypeMap>(df: DataFrame<T>) {
  const toArrowMetadata = (name: string|number, type?: DataType): ToArrowMetadata => {
    if (!type || !type.children || !type.children.length) { return [name]; }
    if (type instanceof arrow.List) {
      if (!type.children[0]) { return [name, [[0], [1]]]; }
      return [name, [[0], toArrowMetadata(type.children[0].name, type.children[0].type)]];
    }
    return [name, type.children.map((f) => toArrowMetadata(f.name, f.type))];
  };
  const names = df.names.map((name) => toArrowMetadata(<string|number>name, df.types[name]));
  return df.asTable().toArrow(names);
}

export function fromArrow<T extends TypeMap>(memory: DeviceBuffer|MemoryData): DataFrame<T> {
  const {names, table} = Table.fromArrow(memory);
  return new DataFrame(names.reduce((map, name, i) => ({...map, [name]: table.getColumnByIndex(i)}),
                                    {} as ColumnsMap<T>));
}

export function fromMessagePortEvent<T>(port: MessagePort, type: string) {
  return Ix.ai.fromEventPattern<T>((h) => port.on(type, h), (h) => port.off(type, h));
}
