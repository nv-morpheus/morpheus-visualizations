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

import { roundToNearestTime } from "./utils";
const { DataFrame, Uint32, Uint64, Series } = require("@rapidsai/cudf");
const path = require("path");

module.exports = () => {
  let timeout = {};
  let datasets = {};

  function clearCachedGPUData(datasetName) {
    datasets[datasetName] = undefined;
  }

  return async function loadDataMiddleware(datasetName, req, res, next) {
    if (timeout[datasetName]) {
      clearTimeout(timeout[datasetName]);
    }

    // Set a 10-minute debounce to release server GPU memory
    timeout[datasetName] = setTimeout(
      clearCachedGPUData.bind(null, datasetName),
      10 * 60 * 1000
    );

    req[datasetName] =
      datasets[datasetName] ||
      (datasets[datasetName] = await readDataset(datasets, datasetName));

    if (req.query.lookBackTime) {
      req[datasetName + "_queried"] = await queryDataset(
        datasets[datasetName],
        parseInt(req.query.lookBackTime)
      );
    }

    next();
  };
};

async function queryDataset(df, lookBackTime) {
  if (lookBackTime == -1) {
    return df;
  }
  const time = Series.new(df.get("time").data).cast(new Uint64());
  if (lookBackTime == parseInt(time.min()) * 1000) {
    return df;
  }
  const resultMask = time.gt(parseInt(time.max()) - lookBackTime * 1000); //convert lookbacktime to ms
  return df.filter(resultMask);
}

async function readDataset(datasets, datasetName) {
  let fn = DataFrame.readParquet;
  datasetName = path.join(process.env.dataset_path, datasetName);
  if (path.extname(datasetName) == ".csv") {
    fn = DataFrame.readCSV;
  }

  let data = fn({
    sourceType: "files",
    sources: [datasetName],
  });

  const attrs = data.drop(["user", "time"]).names;
  attrs.forEach((attr) => {
    const attr_mean = data
      .get(attr)
      .sub(data.get(attr).min())
      // using 95th percentile score to compute scaled values
      .div(data.get(attr).quantile(0.95, "linear") - data.get(attr).min());
    data = data.assign({
      [`${attr}_scaled`]: attr_mean,
    });
  });
  const time = roundToNearestTime(data.get("time"), 5);

  return data
    .assign({
      userID: data.get("user").encodeLabels().cast(new Uint32()),
      timeBins: time._castAsString().encodeLabels().cast(new Uint32()),
      time: time,
      userPrincipalName: data.get("user").replaceSlice(" \n", -3, -1),
      index: Series.sequence({
        size: data.numRows,
        init: 0,
        dtype: new Uint32(),
        step: 1,
      }),
    })
    .rename({
      anomalyScore_scaled: "anomaly_score",
    })
    .sortValues({ time: { ascending: true } });
}
