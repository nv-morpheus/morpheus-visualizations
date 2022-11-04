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

import React, { useEffect, useState } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import { List } from "react-bootstrap-icons";
import CloseButton from "react-bootstrap/CloseButton";
import ListGroup from "react-bootstrap/ListGroup";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import Form from "react-bootstrap/Form";
import styles from "../../styles/components/sidePanels.module.css";
import { ArrowClockwise } from "react-bootstrap-icons";
import { Button } from "react-bootstrap";

const handleStyle = {
  borderColor: "white",
  boxShadow: "white",
  height: 13,
  width: 13,
  marginTop: -2,
  opacity: 1,
  radius: 1,
};

const trackStyle = { backgroundColor: "gray", height: 10 };

const railStyle = {
  backgroundColor: "#0f0f0f",
  border: "solid 1px white",
  height: 10,
};

async function requestJSON(type = "getFiles", params = null) {
  let url = `/api/${type}`;
  if (params != null) {
    url += `${params}`;
  }
  return await fetch(url, {
    method: "GET",
    headers: { "Access-Control-Allow-Origin": "*" },
  })
    .then((res) => res.json())
    .catch((e) => console.log(e));
}

function ConfigPanel({ config, updateConfig, reloadCharts }) {
  const [show, setShow] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [reload, clickReload] = useState(false);
  const [configValues, setConfigValues] = useState({
    colorThreshold: config.anomalousColorThreshold.map((x) => x * 100),
    visibleUsers: { value: config.visibleUsers.value },
    sortFrequency: [1], //seconds
    updateFrequency: [1], //seconds
    timePerHex: [config.timePerHex], //seconds
    lookBackTime: [config.lookBackTime], //seconds
    lookBackTimeRange: eval(process.env.NEXT_PUBLIC_look_back_time_range),
    timePerHexRange: eval(process.env.NEXT_PUBLIC_time_bin_per_hex_range),
  });

  useEffect(() => {
    const fetchFiles = async () => {
      const datasets = await requestJSON("getFiles");
      setDatasets(datasets);
      updateConfig("currentDataset", datasets[0]);
    };
    fetchFiles();
  }, [reload, updateConfig]);

  const refreshDatasets = () => {
    clickReload(!reload);
  };

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <a href={"#"} onClick={handleShow}>
        <List color={"white"} size={22} />
      </a>

      <Offcanvas
        show={show}
        onHide={handleClose}
        scroll={true}
        backdrop={false}
        id={styles.configPanel}
      >
        <Offcanvas.Header>
          <Offcanvas.Title>Settings</Offcanvas.Title>
          <CloseButton variant="white" onClick={() => setShow(false)} />
        </Offcanvas.Header>

        <ListGroup>
          <ListGroup.Item className={styles.listOfAttributes} key={"datasets"}>
            <div className={styles.configTitle}>
              Current Dataset
              <a href="#" onClick={refreshDatasets}>
                <ArrowClockwise></ArrowClockwise>
              </a>
            </div>
            <select
              name="sortEvents"
              className={styles.configTools}
              value={config.currentDataset}
              onChange={(e) => {
                updateConfig("currentDataset", e.target.value);
              }}
            >
              {datasets.map((dataset, i) => {
                return (
                  <option value={dataset} key={dataset}>
                    {dataset}
                  </option>
                );
              })}
            </select>
          </ListGroup.Item>

          <ListGroup.Item className={styles.listOfAttributes} key={"sort"}>
            <div className={styles.configTitle}>Sort By (Highest on Top)</div>
            <select
              name="sortEvents"
              className={styles.configTools}
              value={config.sortBy}
              onChange={(e) => {
                updateConfig("sortBy", e.target.value);
                setConfigValues({
                  visibleUsers: { value: config.visibleUsers.value },
                });
              }}
            >
              <option value={"mean"}>Mean Anomalous Score</option>
              <option value={"sum"}>Sum of Anomalous Scores</option>
              <option value={"max"}>Max Anomalous Score</option>
              <option value={"min"}>Min Anomalous Score</option>
              <option value={"count"}>No. of Events</option>
            </select>
          </ListGroup.Item>

          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"colorThreshold"}
          >
            <div className={styles.configTitle}>Anomalous Color Threshold</div>
            <Slider
              className={`${styles.configSlider}`}
              range
              min={0}
              max={100}
              defaultValue={configValues.colorThreshold}
              onChange={(e) => {
                setConfigValues({ ...configValues, colorThreshold: e });
                updateConfig(
                  "anomalousColorThreshold",
                  e.map((x) => x / 100)
                );
              }}
              handleStyle={[handleStyle, handleStyle]}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.colorThreshold[0]]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.colorThreshold[0] / 100}</span>,
                },
                [configValues.colorThreshold[1]]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.colorThreshold[1] / 100}</span>,
                },
              }}
            />
          </ListGroup.Item>
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"visibleUsers"}
          >
            <div className={styles.configTitle}>Visible Users (Rows)</div>
            <Slider
              className={`${styles.configSlider}`}
              min={config.visibleUsers.min}
              max={config.visibleUsers.max}
              defaultValue={config.visibleUsers.value}
              onChange={(e) => {
                setConfigValues({
                  ...configValues,
                  visibleUsers: { value: e },
                });
              }}
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.visibleUsers.value]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.visibleUsers.value}</span>,
                },
              }}
            />
          </ListGroup.Item>
          {/* <ListGroup.Item
            className={styles.listOfAttributes}
            key={"sortFrequency"}
          >
            <div className={styles.configTitle}>Sort Frequency</div>
            <Slider
              className={`${styles.configSlider}`}
              min={0}
              max={60}
              defaultValue={configValues.sortFrequency}
              onChange={(e) =>
                setConfigValues({ ...configValues, sortFrequency: e })
              }
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.sortFrequency]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.sortFrequency} sec</span>,
                },
              }}
            />
          </ListGroup.Item>
          <br></br>
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"updateFrequency"}
          >
            <div className={styles.configTitle}>Update Frequency</div>
            <Slider
              className={`${styles.configSlider}`}
              min={0}
              max={300}
              defaultValue={configValues.updateFrequency}
              onChange={(e) =>
                setConfigValues({ ...configValues, updateFrequency: e })
              }
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.updateFrequency]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.updateFrequency} sec</span>,
                },
              }}
            />
          </ListGroup.Item>
          <br></br>*/}
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"timeBinPerHexagon"}
          >
            <div className={styles.configTitle}>Time Bin Per Hexagon</div>
            <Slider
              className={`${styles.configSlider}`}
              min={configValues.timePerHexRange[0]}
              max={configValues.timePerHexRange[1]}
              defaultValue={configValues.timePerHex}
              onChange={(e) => {
                setConfigValues({ ...configValues, timePerHex: e });
                updateConfig("timePerHex", e);
              }}
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.timePerHex]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.timePerHex} sec</span>,
                },
              }}
            />
          </ListGroup.Item>
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"lookBackTime"}
          >
            <div className={styles.configTitle}>Look Back Time</div>
            <Slider
              className={`${styles.configSlider}`}
              min={configValues.lookBackTimeRange[0]}
              max={configValues.lookBackTimeRange[1]}
              defaultValue={configValues.lookBackTime}
              onChange={(e) => {
                setConfigValues({ ...configValues, lookBackTime: e });
                updateConfig("lookBackTime", e);
              }}
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [configValues.lookBackTime]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{configValues.lookBackTime} sec</span>,
                },
              }}
            />
          </ListGroup.Item>

          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"applySettings"}
          >
            <Button
              variant="secondary"
              size="sm"
              className={styles.configButton}
              onClick={() => {
                reloadCharts(configValues);
              }}
            >
              Apply
            </Button>
          </ListGroup.Item>
          <div className={styles.underline}></div>
          <br></br>
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"liveUpdates"}
          >
            <div className={styles.configTitle}>Live Updates</div>
            <Form.Switch
              className={`${styles.configSwitch} configSwitch`}
              checked={config.liveUpdates}
              onChange={(e) => {
                updateConfig("liveUpdates", e.target.checked);
              }}
              label={config.liveUpdates ? "on" : "off"}
            />
          </ListGroup.Item>
          <ListGroup.Item
            className={styles.listOfAttributes}
            key={"3dPerspectiveLock"}
          >
            <div className={styles.configTitle}>3d Perspective Lock</div>
            <Form.Switch
              className={`${styles.configSwitch} configSwitch`}
              checked={config.threeDimensionPerspectiveLock}
              onChange={(e) => {
                updateConfig("threeDimensionPerspectiveLock", e.target.checked);
              }}
              label={config.threeDimensionPerspectiveLock ? "on" : "off"}
            />
          </ListGroup.Item>
        </ListGroup>
      </Offcanvas>
    </>
  );
}

export default ConfigPanel;
