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

import { Series } from '@rapidsai/cudf';

export const defaultColorPalette = Series.new(new Uint32Array([
  // # https://colorbrewer2.org/#type=diverging&scheme=Spectral&n=9
  '#f46d43', // (orange)
  '#d53e4f', // (light-ish red)
  // '#fdae61', // (light orange)
  '#fee08b', // (yellow)
  '#ffffbf', // (yellowish white)
  '#e6f598', // (light yellowish green)
  '#abdda4', // (light green)
  '#66c2a5', // (teal)
  '#3288bd', // (blue)

  '#76b900', // NVIDIA green
  '#1A1918', // NVIDIA black
].map((x: string) => parseInt('0xff' + x.slice(1), 16))));
