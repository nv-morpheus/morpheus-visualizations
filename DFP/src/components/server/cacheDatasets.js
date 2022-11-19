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
const NodeCache = require("node-cache");
const { DataFrame, Uint32, Uint64, Series } = require("@rapidsai/cudf");
const path = require("path");

const cache = new NodeCache({ stdTTL: 10 * 60, useClones: false });

module.exports = () => {
  return async function loadDataMiddleware(datasetName, req, res, next) {
    const timePerHexBin = req.query.timePerHexBin
      ? parseInt(req.query.timePerHexBin)
      : cache.get(datasetName + "_timePerHexBin") || 1;

    if (
      !cache.get(datasetName) ||
      (cache.get(datasetName + "_timePerHexBin") &&
        cache.get(datasetName + "_timePerHexBin") !== timePerHexBin)
    ) {
      const value = await readDataset(datasetName, timePerHexBin);
      const meanScores = await computeMeanScores(datasetName, value);
      cache.set(datasetName, value);
      cache.set(datasetName + "_timePerHexBin", timePerHexBin, 0);
      cache.set(datasetName + "_mean_scores", meanScores, 0);
    }
    req[datasetName] = cache.get(datasetName);
    req[datasetName + "_mean_scores"] = cache.get(datasetName + "_mean_scores");

    if (req.query.lookBackTime) {
      req[datasetName + "_queried"] = await queryDataset(
        cache.get(datasetName),
        req.query.lookBackTime ? parseInt(req.query.lookBackTime) : -1
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

async function computeMeanScores(datasetName, df) {
  const attrs = df.drop([
    "user",
    "userID",
    "time",
    "timeBins",
    "anomalyScore",
    "anomalyScore_scaled",
    "index",
  ]).names;

  return attrs.reduce((map, attr) => {
    const attr_prefix = datasetName.includes("azure") ? "azure_" : "duo_";

    const mean =
      parseFloat(
        process.env[attr_prefix + attr.replace("_score", "") + "_z_loss_mean"]
      ) || df.get(attr).mean();

    return { ...map, [attr + "_mean"]: mean };
  }, {});
}

async function readDataset(datasetName, timePerHexBin) {
  console.log(`reading ${datasetName} ...`);
  let fn = DataFrame.readParquet;
  if (process.env.dataset_path) {
    datasetName = path.join(process.env.dataset_path, datasetName);
  } else {
    datasetName = path.join(__dirname, "../../../../public/data", datasetName);
  }
  if (path.extname(datasetName) == ".csv") {
    fn = DataFrame.readCSV;
  }

  let data = fn({
    sourceType: "files",
    sources: [datasetName],
  });

  const attrs = data.drop(["user", "time"]).names;
  attrs.forEach((attr) => {
    const attr_prefix = datasetName.includes("azure") ? "azure_" : "duo_";

    const min =
      parseFloat(
        process.env[attr_prefix + attr.replace("_score", "") + "_z_loss_min"]
      ) || data.get(attr).min();
    let max =
      parseFloat(
        process.env[attr_prefix + attr.replace("_score", "") + "_z_loss_max"]
      ) || data.get(attr).max();

    const attr_scaled = data
      .get(attr)
      .sub(min)
      // using 95th percentile score to compute scaled values
      .div(max - min);
    data = data.assign({
      [`${attr}_scaled`]: attr_scaled,
    });
  });

  const time = roundToNearestTime(data.get("time"), timePerHexBin);

  return data
    .assign({
      userID: data.get("user").encodeLabels().cast(new Uint32()),
      timeBins: time._castAsString().encodeLabels().cast(new Uint32()),
      time: time,
      user: data.get("user").replaceSlice(" \n", -3, -1),
      index: Series.sequence({
        size: data.numRows,
        init: 0,
        dtype: new Uint32(),
        step: 1,
      }),
    })
    .sortValues({ time: { ascending: true } });
}
