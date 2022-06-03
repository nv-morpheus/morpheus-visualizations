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

import {DataFrame, DataType, ToArrowMetadata, TypeMap} from '@rapidsai/cudf';
import * as arrow from 'apache-arrow';
import {performance} from 'perf_hooks';

export function logRuntime<F extends(...args: any[]) => any>(name: string, fn: F): ReturnType<F> {
  const t = performance.now();
  const r = fn();
  if (!!process.env.DEBUG) { console.log(`${name}: ${(performance.now() - t).toFixed(1)}ms`); }
  return r;
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
