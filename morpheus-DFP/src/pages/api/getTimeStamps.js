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

const cache = require("../../components/server/cacheDatasets")();
import runMiddleware from "../../components/server/runMiddleware";

export default async function handler(req, res) {
  const datasetName = req.query.dataset;
  await runMiddleware(datasetName, req, res, cache);
  const time = req.query.time
    ? parseInt(req.query.time)
    : req[datasetName].get("time").min();
  const lookBackTime = req.query.lookBackTime
    ? parseInt(req.query.lookBackTime)
    : 20;

  const timestamps = req[datasetName]
    .filter(req[datasetName].get("time").le(time))
    .get("time_")
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
}
