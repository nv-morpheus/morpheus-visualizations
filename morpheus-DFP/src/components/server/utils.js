const pipeline = require("util").promisify(require("stream").pipeline);
const { RecordBatchStreamWriter } = require("apache-arrow");
import {
  DataFrame,
  Int32,
  Uint32,
  Series,
  Float32,
  Uint64,
  TimestampMillisecond,
} from "@rapidsai/cudf";
const D3Node = require("d3-node");
const d3 = new D3Node().d3; // initializes D3 with container element

export async function sendDF(df, res) {
  await pipeline(
    RecordBatchStreamWriter.writeAll(df.toArrow()).toNodeStream(),
    res.writeHead(200, "Ok", { "Content-Type": "application/octet-stream" })
  );
}

export function roundToNearestTime(ser_, seconds = 10) {
  const timeSeries = Series.new(ser_.cast(new TimestampMillisecond()).data)
    .div(seconds * 1000)
    .rint()
    .mul(seconds * 1000)
    .cast(new Uint64()).data;

  return Series.new({ data: timeSeries, type: new TimestampMillisecond() });
}

export function offsetBasedGridData(df, hexRadius, numUsers) {
  let x = Series.new([]).cast(new Float32());
  let sortIndex = Series.new([]).cast(new Int32());
  let y = Series.new([]).cast(new Float32());
  let time = Series.new([]).cast(new Int32());
  const maxTime = df.get("timeBins").nunique();

  for (var t = 0; t < maxTime; t++) {
    x = x
      .concat(
        Series.sequence({
          type: new Float32(),
          init: hexRadius * t * Math.sqrt(3),
          step: 0,
          size: Math.ceil(numUsers / 2),
        })
      )
      .concat(
        Series.sequence({
          type: new Float32(),
          init: hexRadius * t * Math.sqrt(3) + (hexRadius * Math.sqrt(3)) / 2,
          step: 0,
          size: Math.floor(numUsers / 2),
        })
      );

    sortIndex = sortIndex
      .concat(
        Series.sequence({
          type: new Int32(),
          init: t * numUsers,
          step: 2,
          size: Math.ceil(numUsers / 2),
        })
      )
      .concat(
        Series.sequence({
          type: new Int32(),
          init: t * numUsers + 1,
          step: 2,
          size: Math.floor(numUsers / 2),
        })
      );

    y = y
      .concat(
        Series.sequence({
          type: new Float32(),
          init: 0,
          step: hexRadius * 3,
          size: Math.ceil(numUsers / 2),
        })
      )
      .concat(
        Series.sequence({
          type: new Float32(),
          init: hexRadius * 1.5,
          step: hexRadius * 3,
          size: Math.floor(numUsers / 2),
        })
      );

    time = time.concat(
      Series.sequence({
        type: new Int32(),
        init: t,
        step: 0,
        size: numUsers,
      })
    );
  }
  let coords = new DataFrame({
    x,
    y,
    time,
    sortIndex,
  }).sortValues({
    sortIndex: { ascending: true },
  });

  return coords.assign({
    offset_0: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_1: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_2: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_3: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_4: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    elevation: Series.sequence({
      step: 0,
      init: -1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_6: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_7: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_8: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_9: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_10: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_11: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_13: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    offset_15: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    color_r: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    color_g: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    color_b: Series.sequence({
      step: 0,
      init: 1,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
    anomaly_scoreMax: Series.sequence({
      step: 0,
      init: 0,
      type: new Float32(),
      size: numUsers * maxTime,
    }),
  });
}

export const namesPosition = [
  "offset_0",
  "offset_1",
  "offset_2",
  "offset_3",
  "offset_4",
  "elevation",
  "offset_6",
  "offset_7",
  "offset_8",
  "offset_9",
  "offset_10",
  "offset_11",
  "x",
  "offset_13",
  "y",
  "offset_15",
];

export const namesColor = ["color_r", "color_g", "color_b"];

export function compAggregate(df, aggregateFn = "sum") {
  let result_df = df;
  switch (aggregateFn) {
    case "sum":
      result_df = df.sum();
      break;
    case "mean":
      result_df = df.mean();
      break;
    case "max":
      result_df = df.max();
      break;
    case "min":
      result_df = df.min();
      break;
    case "count":
      result_df = df.count();
      break;
    default:
      result_df = df.sum();
      break;
  }
  return result_df
    .sortValues({ userID: { ascending: true } })
    .assign({
      index: Series.sequence({
        type: new Uint32(),
        init: 0,
        size: result_df.get("userID").nunique(),
        step: 1,
      }),
    })
    .sortValues({ anomalyScore_scaled: { ascending: false } })
    .get("index");
}

export function getInstances(
  df,
  instanceID,
  sort = false,
  sortBy = "sum",
  numUsers = -1
) {
  let order = sort
    ? compAggregate(
        df.select(["userID", "anomalyScore_scaled"]).groupBy({ by: "userID" }),
        sortBy
      )
    : df.get("userID").unique();

  if (numUsers != -1) {
    order = order.head(numUsers);
    df = df.join({
      other: new DataFrame({ userID: order }),
      on: ["userID"],
      how: "right",
    });
    order = sort
      ? compAggregate(
          df
            .select(["userID", "anomalyScore_scaled"])
            .groupBy({ by: "userID" }),
          sortBy
        )
      : df.get("userID").unique();
  }

  const totalUsers = df.get("userID").nunique();
  const timeBins = parseInt(
    Math.ceil(df.get("timeBins").max() - instanceID / totalUsers)
  );

  const userID = df
    .get("userID")
    .unique()
    .sortValues(true)
    .getValue(order.getValue(parseInt(instanceID % totalUsers)));

  const resultMask = df
    .get("userID")
    .eq(userID)
    .logicalAnd(df.get("timeBins").eq(timeBins));

  return df
    .filter(resultMask)
    .select(["userID", "time", "index", "anomalyScore_scaled"])
    .sortValues({ anomalyScore_scaled: { ascending: false } });
}
export function getEventStats(df, threshold) {
  const totalEvents = df
    .groupBy({ by: "time" })
    .count()
    .select(["time", "user"])
    .sortValues({ time: { ascending: false } })
    .rename({ user: "count" })
    .toArrow()
    .toArray();
  const anomalousEvents = df
    .filter(df.get("anomalyScore_scaled").ge(threshold))
    .groupBy({ by: "time" })
    .count()
    .select(["time", "user"])
    .sortValues({ time: { ascending: false } })
    .rename({ user: "count" })
    .toArrow()
    .toArray();

  return {
    totalEvents: totalEvents.reduce(
      (map, value) => map.concat([Object.values(value)]),
      []
    ),
    anomalousEvents: anomalousEvents.reduce(
      (map, value) => map.concat([Object.values(value)]),
      []
    ),
  };
}
export function generateData(
  df,
  df_queried,
  type = "elevation",
  sort = false,
  sortBy = "sum",
  numUsers = -1,
  colorThreshold = [0.1, 0.385]
) {
  let order = sort
    ? compAggregate(
        df.select(["userID", "anomalyScore_scaled"]).groupBy({ by: "userID" }),
        sortBy
      )
    : df.get("userID").unique();

  if (numUsers != -1) {
    order = order.head(numUsers);
    df = df.join({
      other: new DataFrame({ userID: order }),
      on: ["userID"],
      how: "right",
    });
    df_queried = df_queried.join({
      other: new DataFrame({ userID: order }),
      on: ["userID"],
      how: "right",
    });
    order = sort
      ? compAggregate(
          df
            .select(["userID", "anomalyScore_scaled"])
            .groupBy({ by: "userID" }),
          sortBy
        )
      : df.get("userID").unique();
  }

  const names = df
    .sortValues({ userID: { ascending: true } })
    .get("user")
    .unique();
  const paddingDF = new DataFrame({
    userID: df
      .sortValues({ userID: { ascending: true } })
      .get("userID")
      .unique(),
    names: names,
  });

  if (type == "userIDs") {
    return new DataFrame({ names: names.gather(order) });
  }

  const maxRows = Math.min(df.get("userID").nunique(), numUsers);

  let tempData = offsetBasedGridData(df_queried, 20, maxRows);

  const group = df_queried
    .select(["userID", "timeBins", "anomalyScore_scaled"])
    .groupBy({ by: ["userID", "timeBins"] });
  let finData = group.sum();

  finData = finData
    .assign({
      anomaly_scoreMax: group.max().get("anomalyScore_scaled"),
      elevation: group.count().get("anomalyScore_scaled"),
      userID: finData.get("userID_timeBins").getChild("userID"),
      timeBins: finData.get("userID_timeBins").getChild("timeBins"),
    })
    .drop(["userID_timeBins"])
    .sortValues({ userID: { ascending: true }, timeBins: { ascending: true } })
    .sortValues({ anomalyScore_scaled: { ascending: false } });

  console.time(`compute${type}${df_queried.get("timeBins").max()}`);
  [
    ...df_queried.get("timeBins").unique().sortValues(false).dropNulls(),
  ].forEach((t) => {
    const gridTime = df_queried.get("timeBins").max() - t;

    if (gridTime * maxRows < tempData.numRows) {
      let sortedResults = finData.filter(finData.get("timeBins").eq(t));
      sortedResults = sortedResults
        .join({ other: paddingDF, on: ["userID"], how: "outer", rsuffix: "_r" })
        .drop(["userID_r"])
        .sortValues({ userID: { ascending: true } });
      sortedResults = sortedResults.gather(order);

      const gridIndex = Series.sequence({
        size: order.length,
        init: 0,
        step: 1,
        type: new Uint32(),
      })
        .add(maxRows * gridTime)
        .cast(new Int32());

      if (type == "elevation") {
        const elevation_ = sortedResults.get("elevation").replaceNulls(-1);
        tempData = tempData.assign({
          elevation: tempData.get("elevation").scatter(elevation_, gridIndex),
        });
      } else if (type == "colors") {
        const anomaly_scoreMax_ = sortedResults.get("anomaly_scoreMax");
        tempData = tempData.assign({
          anomaly_scoreMax: tempData
            .get("anomaly_scoreMax")
            .scatter(anomaly_scoreMax_, gridIndex),
        });
      }
    }
  });
  if (type == "colors") {
    const colors = mapValuesToColorSeries(
      tempData.get("anomaly_scoreMax"),
      [colorThreshold[0], colorThreshold[1], 0.01],
      ["#f00", "#ff0"]
    );
    tempData = tempData.assign({
      color_r: colors.color_r,
      color_g: colors.color_g,
      color_b: colors.color_b,
    });
  }
  console.timeEnd(`compute${type}${df_queried.get("timeBins").max()}`);

  return new DataFrame({
    [type]: tempData
      .select(type == "elevation" ? namesPosition : namesColor)
      .interleaveColumns()
      .cast(new Float32()),
  });
}

function hexToRgb(rgb) {
  var result = d3.color(rgb);
  return result
    ? {
        r: result.r / 255,
        g: result.g / 255,
        b: result.b / 255,
      }
    : null;
}

export function mapValuesToColorSeries(
  values,
  domain,
  colors_,
  nullColor = { r: 33, g: 33, b: 33 }
) {
  // validate colors and domain lengths
  if (colors_.length < 1 || domain.length < 1) {
    throw new Error("colors and domain must be arrays of length 1 or greater");
  }
  const colors = d3
    .scaleSequential()
    .interpolator(d3.interpolateRgb(colors_[0], colors_[1]))
    .domain([domain[0] * 100, domain[1] * 100]);

  const color_r = Series.sequence({
    step: 0,
    init: nullColor.r / 255,
    type: new Float32(),
    size: values.length,
  });
  const color_g = Series.sequence({
    step: 0,
    init: nullColor.g / 255,
    type: new Float32(),
    size: values.length,
  });
  const color_b = Series.sequence({
    step: 0,
    init: nullColor.b / 255,
    type: new Float32(),
    size: values.length,
  });

  const colorIndices = Series.sequence({
    type: new Uint32(),
    init: 0,
    step: 1,
    size: values.length,
  });

  if (domain.length == 1) {
    const boolMask = values.ge(domain[0]);
    const indices = colorIndices.filter(boolMask);
    const color = hexToRgb(colors(domain[0] * 100));
    color_r.setValues(indices, color.r);
    color_g.setValues(indices, color.g);
    color_b.setValues(indices, color.b);
  } else {
    for (let i = domain[0]; i < domain[1]; i += domain[2]) {
      const boolMask = values.ge(i);
      const indices = colorIndices.filter(boolMask);
      const color = hexToRgb(colors(i * 100));
      color_r.setValues(indices, color.r);
      color_g.setValues(indices, color.g);
      color_b.setValues(indices, color.b);
    }
  }

  return { color_r, color_g, color_b };
}
