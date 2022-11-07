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

import { sendDF, generateData } from "../../components/server/utils";
const cache = require("../../components/server/cacheDatasets")();
import runMiddleware from "../../components/server/runMiddleware";
import { Uint32 } from "@rapidsai/cudf";

export default async function handler(req, res) {
  const [fn] = req.query.param;
  const datasetName = req.query.dataset;
  await runMiddleware(datasetName, req, res, cache);
  const sort = req.query.sort ? req.query.sort === "true" : false;
  const sortBy = req.query.sortBy ? req.query.sortBy : "sum";
  const numUsers = req.query.numUsers ? parseInt(req.query.numUsers) : -1;
  const colorThreshold = req.query.colorThreshold
    ? req.query.colorThreshold.split(",").map((x) => parseFloat(x))
    : [0.1, 0.385];
  const lookBackTime = req.query.lookBackTime
    ? parseInt(req.query.lookBackTime)
    : 20;

  switch (fn) {
    case "getDFColors":
      sendDF(
        generateData(
          req[datasetName],
          req[datasetName + "_queried"],
          "colors",
          sort,
          sortBy,
          numUsers,
          colorThreshold
        ),
        res
      );
      break;
    case "getDFElevation":
      const result = generateData(
        req[datasetName],
        req[datasetName + "_queried"],
        "elevation",
        sort,
        sortBy,
        numUsers,
        lookBackTime
      );

      sendDF(result, res);
      break;
    case "getUniqueIDs":
      sendDF(
        generateData(
          req[datasetName],
          req[datasetName + "_queried"],
          "userIDs",
          sort,
          sortBy,
          numUsers
        ),
        res
      );
      break;
    case "getEventByIndex":
      const index = req.query.index ? parseInt(req.query.index) : -1;
      if (index >= 0) {
        const tempData = req[datasetName].filter(
          req[datasetName].get("index").eq(index)
        );

        res.end({
          result: tempData.toArrow().toArray(),
        });
      } else {
        res.end({
          result: null,
        });
      }
      break;
    case "getEventStats":
      const anomalyThreshold = req.query.anomalyThreshold
        ? parseFloat(req.query.anomalyThreshold)
        : 0.385;

      res.send({
        totalEvents:
          req[datasetName].numRows -
          req[datasetName].get("anomaly_score").nullCount,
        totalAnomalousEvents: req[datasetName].filter(
          req[datasetName].get("anomaly_score").ge(anomalyThreshold)
        ).numRows,
        time: req[datasetName].get("time").getValue(0),
      });
      break;
    case "getInstances":
      const id = req.query.id ? parseInt(req.query.id) : -1;
      if (id >= 0) {
        res.send({
          result: getInstances(req[datasetName], id, sort, sortBy, numUsers)
            .toArrow()
            .toArray(),
        });
      } else {
        res.send({
          result: null,
        });
      }
      break;
    case "getNumUsers":
      res.send({ numUsers: req[datasetName].get("userID").nunique() });
      break;
    case "getTimeStamps":
      const timestamps = req[datasetName]
        .get("time")
        .unique()
        .sortValues(false)
        .head(lookBackTime);

      let indices = [...Array(parseInt(timestamps.length / 10))].map(
        (_, i) => i * 10
      );
      if (timestamps.length % 10 !== 0) {
        indices = indices.concat(timestamps.length - (timestamps.length % 10));
      }
      res.send({
        timeStamps: [...timestamps.gather(indices)],
      });
      break;
    case "getTotalTime":
      res.send(req[datasetName].get("timeBins").unique().dropNulls().length);
      break;
    default:
      res.status(400).send("invalid route");
  }
}
