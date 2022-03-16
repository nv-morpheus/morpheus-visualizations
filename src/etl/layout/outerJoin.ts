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

import {
  addon as CUDF,
  ColumnsMap,
  CommonType,
  DataFrame,
  findCommonType,
  Series,
  SeriesMap,
  TypeMap
} from '@rapidsai/cudf';
import {JoinResult} from '@rapidsai/cudf/build/js/dataframe/join';
import {MemoryResource} from '@rapidsai/rmm';
import {compareTypes} from 'apache-arrow/visitor/typecomparator';

// clang-format off
export function outerJoin<T extends TypeMap, R extends TypeMap, TOn extends (string & keyof T & keyof R), LSuffix extends string = '', RSuffix extends string = ''>(
  lhs: DataFrame<T>,
  props: JoinProps<R, TOn, 'inner'|'outer'|'left'|'right', LSuffix, RSuffix>
): DataFrame<{
  [P in keyof JoinResult<T, R, TOn, LSuffix, RSuffix>]:
    P extends TOn
      ? CommonType<T[P], R[P]>
      : JoinResult<T, R, TOn, LSuffix, RSuffix>[P]
}> {
  // clang-format on
  const {how = 'inner', other, ...opts} = props;
  return new Join({...opts, lhs, rhs: other}).outer();
}

class Join<Lhs extends TypeMap, Rhs extends TypeMap, TOn extends(string & keyof Lhs & keyof Rhs),
                                                                LSuffix extends
             string, RSuffix extends string> {
  // clang-format on
  private lhs: DataFrame<Lhs>;
  private rhs: DataFrame<Rhs>;
  private on: TOn[];
  private lsuffix: LSuffix|'';
  private rsuffix: RSuffix|'';
  private nullEquality: boolean;
  private memoryResource?: MemoryResource;

  constructor(props: JoinConstructorProps<Lhs, Rhs, TOn, LSuffix, RSuffix>) {
    const {lsuffix = '', rsuffix = '', nullEquality = true} = props;
    this.lhs                                                = props.lhs;
    this.rhs                                                = props.rhs;
    this.on                                                 = props.on;
    this.lsuffix                                            = lsuffix;
    this.rsuffix                                            = rsuffix;
    this.nullEquality                                       = nullEquality;
    this.memoryResource                                     = props.memoryResource;

    this.on.forEach((name) => {
      const lhs_col = this.lhs.get(name);
      const rhs_col = this.rhs.get(name);
      if (!compareTypes(lhs_col.type, rhs_col.type)) {
        const type = findCommonType(lhs_col.type, rhs_col.type);
        this.lhs   = this.lhs.assign({[name]: lhs_col.cast(type)}) as any as DataFrame<Lhs>;
        this.rhs   = this.rhs.assign({[name]: rhs_col.cast(type)}) as any as DataFrame<Rhs>;
      }
    });
  }

  public outer() {
    const {on, lsuffix, rsuffix} = this;

    // clang-format off
    const [lhsMap, rhsMap] = CUDF.Table.fullJoin(
      this.lhs.select(on).asTable(),
      this.rhs.select(on).asTable(),
      this.nullEquality,
      this.memoryResource
    ).map((col: any) => Series.new(col));
    // clang-format on

    const lhs = this.lhs.gather(lhsMap, true);
    const rhs = this.rhs.gather(rhsMap, true);

    let commonNames = on as string[];

    if (lsuffix + rsuffix === '') {
      commonNames = [...new Set([...this.lhs.names, ...this.rhs.names])];
    }

    // clang-format off
    // replace lhs nulls with rhs valids for each common column name
    const lhsValids = lhs.assign(commonNames.reduce((cols, name) => ({
      ...cols, [name]: lhs.get(name).replaceNulls(rhs.get(name) as any)
    }), <any>{}) as SeriesMap<Lhs>);
    // clang-format on

    const result = mergeResults(lhsValids, rhs.drop(on), on, lsuffix, rsuffix);
    return new DataFrame(result);
  }
}

// clang-format off
function mergeResults<
  Lhs extends TypeMap,
  Rhs extends TypeMap,
  TOn extends string,
  LSuffix extends string,
  RSuffix extends string
>(lhs: DataFrame<Lhs>, rhs: DataFrame<Rhs>, on: TOn[], lsuffix: LSuffix, rsuffix: RSuffix) {
  type TResult = JoinResult<Lhs, Rhs, TOn, LSuffix, RSuffix>;
  // clang-format on
  function getColumns<T extends TypeMap>(
    lhs: DataFrame<T>, rhsNames: readonly string[], suffix: string) {
    return lhs.names.reduce((cols, name) => {
      const newName = on.includes(name as TOn)  ? name
                      : rhsNames.includes(name) ? `${name}${suffix}`
                                                : name;
      cols[newName] = lhs.get(name)._col;
      return cols;
    }, <any>{}) as ColumnsMap<{
             [P in keyof TResult]:  //
               P extends TOn ? CommonType<Lhs[P], Rhs[P]>: TResult[P]
           }>;
  }

  const lhsCols = getColumns(lhs, rhs.names, lsuffix);
  const rhsCols = getColumns(rhs, lhs.names, rsuffix);

  return (
    lsuffix == '' && rsuffix == ''  // <<< If no suffixes and overlapping names,
      ? {...rhsCols, ...lhsCols}    // <<< prefer the lhs cols over the rhs cols,
      : {...lhsCols, ...rhsCols}    // <<< otherwise prefer the right cols.
  );
}

type JoinType = 'inner'|'outer'|'left'|'right'|'leftsemi'|'leftanti';

type JoinProps<
  Rhs extends TypeMap,
  TOn extends string,
  How extends JoinType = 'inner',
  LSuffix extends string = '',
  RSuffix extends string = '',
> = {
  other: DataFrame<Rhs>;
  on: TOn[];
  how?: How;
  lsuffix?: LSuffix;
  rsuffix?: RSuffix;
  nullEquality?: boolean;
  memoryResource?: MemoryResource;
};

interface JoinConstructorProps<
  // clang-format off
  Lhs extends TypeMap,
  Rhs extends TypeMap,
  TOn extends(string & keyof Lhs & keyof Rhs),
  LSuffix extends string,
  RSuffix extends string
  // clang-format on
  > {
  lhs: DataFrame<Lhs>;
  rhs: DataFrame<Rhs>;
  on: TOn[];
  lsuffix?: LSuffix;
  rsuffix?: RSuffix;
  nullEquality?: boolean;
  memoryResource?: MemoryResource;
}
