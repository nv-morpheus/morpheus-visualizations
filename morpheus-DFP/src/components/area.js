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

import ReactCharts from "echarts-for-react";
import React, { useRef } from "react";
import * as echarts from "echarts";

function AreaChart({ totalEvents, anomalousEvents }) {
  const areaRef = useRef();
  const AreaOptions = {
    tooltip: {
      trigger: "axis",
      position: function (pt) {
        return [pt[0], "10%"];
      },
    },
    grid: {
      left: 100,
      right: 50,
    },
    title: {
      textAlign: "left",
      textVerticalAlign: "auto",
      text: "Total Network Traffic Volume",
      textStyle: {
        color: "#ffffff",
        fontSize: "14px",
      },
      top: "5%",
      left: "2%",
    },
    color: ["#f73d0a", "#ffffff"],
    legend: {
      data: [
        {
          name: "Anomalous Traffic",
          icon: "square",
        },
        {
          name: "Network Traffic",
          icon: "square",
        },
      ],
      textStyle: {
        color: "#ffffff",
        fontSize: "14px",
      },
      itemGap: 40,
      bottom: "5%",
      left: "5%",
    },
    xAxis: {
      type: "time",
      name: "Time",
      nameLocation: "end",
      nameTextStyle: {
        color: "#ffffff",
        fontWeight: "bold",
        verticalAlign: "top",
        lineHeight: 30,
        fontSize: 14,
      },
      axisTick: { length: 10 },
      textStyle: {
        color: "#ffffff",
      },
      axisLabel: { color: "#ffffff", margin: 15 },
      inverse: true,
    },
    yAxis: {
      type: "value",
      name: "Events",
      nameLocation: "middle",
      nameTextStyle: {
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: 14,
      },
      axisLabel: { color: "#ffffff", align: "right" },
      splitLine: { lineStyle: { opacity: 0.2 } },
      nameGap: 50,
    },
    series: [
      {
        name: "Anomalous Traffic",
        type: "line",
        symbol: "none",
        stack: true,
        lineStyle: {
          width: 0.7,
        },
        areaStyle: {
          opacity: 1,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1.5, [
            {
              offset: 0,
              color: "#f73d0a",
            },
            {
              offset: 1,
              color: "#000000",
            },
          ]),
        },
        data: anomalousEvents,
      },
      {
        name: "Network Traffic",
        type: "line",
        symbol: "none",
        stack: true,
        lineStyle: {
          width: 0.7,
          color: "#ffffff",
        },
        areaStyle: {
          opacity: 0.7,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1.5, [
            {
              offset: 0,
              color: "#ffffff",
            },
            {
              offset: 1,
              color: "#000000",
            },
          ]),
        },
        data: totalEvents,
      },
    ],
    notMerge: true,
    backgroundColor: "#0f0f0f",
  };

  return (
    <ReactCharts
      ref={areaRef}
      style={{
        height: "100%",
        width: "100%",
      }}
      option={AreaOptions}
    />
  );
}

export default AreaChart;
