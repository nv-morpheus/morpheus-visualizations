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

import React, { useEffect, useState, useRef } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import { List } from "react-bootstrap-icons";
import Spinner from "react-bootstrap/Spinner";
import CloseButton from "react-bootstrap/CloseButton";
import ListGroup from "react-bootstrap/ListGroup";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import Form from "react-bootstrap/Form";
import styles from "../../styles/components/sidePanels.module.css";
import { Button } from "react-bootstrap";
import Trigger from "../overlayTrigger";

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

function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

function ConfigPanel({
  config,
  updateConfig,
  reloadCharts,
  setLoadingIndicator,
  loading,
}) {
  let reloadInterval;
  const [show, setShow] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [reload, clickReload] = useState(false);
  const [configValues, setConfigValues] = useState({
    colorThreshold: config.anomalousColorThreshold.map((x) => x * 100),
    visibleUsers: { value: config.visibleUsers.value },
    updateFrequency: [900], //seconds
    timePerHex: parseInt(config.timePerHex), //seconds
    lookBackTime: config.lookBackTime, //seconds
    timePerHexRange: eval(process.env.NEXT_PUBLIC_time_bin_per_hex_range),
  });

  async function reloadDatasets() {
    const datasets = await requestJSON("getFiles");
    setDatasets(datasets);
    setConfigValues({ ...configValues, currentDataset: datasets[0] });
    reloadCharts({ ...configValues, currentDataset: datasets[0] });
  }

  useEffect(() => {
    reloadDatasets();
  }, []);

  useEffect(() => {
    reloadDatasets();
  }, [reload]);

  useInterval(async () => {
    if (config.liveUpdates) {
      const datasets_ = await requestJSON("getFiles");
      if (datasets_[0] != configValues.currentDataset) {
        setDatasets(datasets_);
        setConfigValues({ ...configValues, currentDataset: datasets_[0] });
        reloadCharts({ ...configValues, currentDataset: datasets_[0] });
      }
    }
  }, configValues.updateFrequency * 1000);

  useEffect(() => {
    setConfigValues({
      ...configValues,
      visibleUsers: { value: config.visibleUsers.value },
      lookBackTime: config.lookBackTime,
      timePerHex: config.timePerHex,
      colorThreshold: config.anomalousColorThreshold.map((x) => x * 100),
    });
  }, [
    config.visibleUsers.value,
    config.lookBackTime,
    config.timePerHex,
    config.anomalousColorThreshold,
  ]);

  useEffect(() => {
    if (!show) {
      setConfigValues({
        ...configValues,
        colorThreshold: config.anomalousColorThreshold.map((x) => x * 100),
        visibleUsers: { value: config.visibleUsers.value },
        timePerHex: parseInt(config.timePerHex), //seconds
        lookBackTime: config.lookBackTime, //seconds
      });
    }
  }, [show]);

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
          <ListGroup.Item className={styles.listOfConfig} key={"datasets"}>
            <div className={styles.configTitle}>
              Current Dataset
              <Trigger
                className={styles.infoHover}
                msg={"List of datasets available"}
                iconName={"ArrowClockwise"}
                onClick={() => clickReload(!reload)}
              ></Trigger>
            </div>

            <select
              name="currentDataset"
              className={`${styles.configTools}`}
              value={configValues.currentDataset}
              onChange={(e) => {
                setConfigValues({
                  ...configValues,
                  currentDataset: e.target.value,
                });
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

          <ListGroup.Item className={styles.listOfConfig} key={"sort"}>
            <div className={styles.configTitle}>
              Sort By (Highest on Top)
              <Trigger
                className={styles.infoHover}
                msg={
                  "Sort the users based on aggregate values of the anomaly scores,in a decreasing order"
                }
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <select
              name="sortEvents"
              className={styles.configTools}
              value={config.sortBy}
              onChange={(e) => {
                updateConfig("sortBy", e.target.value);
              }}
            >
              <option value={"sum"}>Sum of Anomalous Scores</option>
              <option value={"mean"}>Mean Anomalous Score</option>
              <option value={"max"}>Max Anomalous Score</option>
              <option value={"min"}>Min Anomalous Score</option>
              <option value={"count"}>No. of Events</option>
            </select>
          </ListGroup.Item>

          <ListGroup.Item
            className={styles.listOfConfig}
            key={"colorThreshold"}
          >
            <div className={styles.configTitle}>
              Anomalous Color Threshold
              <Trigger
                className={styles.infoHover}
                msgs={[
                  "Min and Max thresholds for anomaly values",
                  "Max threshold: value above which events are considered anomalous",
                  "Min threshold: value below which events are considered safe to ignore",
                  "Events with values between Min and Max will be mapped to a color palette [red, yellow], with yellow being the most anomalous",
                  "Anything above Max is yellow, anything below Min is light-gray, and null events are dark-gray",
                ]}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              range
              min={0}
              max={100}
              value={configValues.colorThreshold}
              onChange={(e) => {
                setConfigValues({ ...configValues, colorThreshold: e });
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
          <ListGroup.Item className={styles.listOfConfig} key={"visibleUsers"}>
            <div className={styles.configTitle}>
              Visible Users (Rows)
              <Trigger
                className={styles.infoHover}
                msgs={[
                  "Number of users visible.",
                  "Default value is the minimum of max_users_in_dataset and `NEXT_PUBLIC_visible_users_max` set in .env file",
                ]}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              min={config.visibleUsers.min}
              max={config.visibleUsers.max}
              value={configValues.visibleUsers.value}
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
          <ListGroup.Item
            className={styles.listOfConfig}
            key={"timeBinPerHexagon"}
          >
            <div className={styles.configTitle}>
              Time Bin Per Hexagon
              <Trigger
                className={styles.infoHover}
                msg={
                  "Specifies, in seconds, how much time does each hexagon aggregate"
                }
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              min={configValues.timePerHexRange[0]}
              max={configValues.timePerHexRange[1]}
              value={configValues.timePerHex}
              onChange={(e) => {
                setConfigValues({ ...configValues, timePerHex: e });
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
          <ListGroup.Item className={styles.listOfConfig} key={"lookBackTime"}>
            <div className={styles.configTitle}>
              Look Back Time
              <Trigger
                className={styles.infoHover}
                msg={
                  "Specifies, in seconds, how far to look back into the dataset, default is 1 HR(36000s)."
                }
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              min={config.lookBackTimeRange[0]}
              max={config.lookBackTimeRange[1]}
              value={configValues.lookBackTime}
              onChange={(e) => {
                setConfigValues({ ...configValues, lookBackTime: e });
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
          <ListGroup.Item className={styles.listOfConfig} key={"applySettings"}>
            {loading ? (
              <Spinner
                animation="border"
                variant="light"
                size="sm"
                className={styles.loadingIcon}
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className={styles.configButton}
                onClick={() => {
                  setLoadingIndicator(true);
                  reloadCharts(configValues);
                }}
              >
                Apply
              </Button>
            )}
          </ListGroup.Item>
          <div className={styles.underline}></div>
          <ListGroup.Item
            className={styles.listOfConfig}
            key={"updateFrequency"}
          >
            <div className={styles.configTitle}>
              Update Frequency
              <Trigger
                className={styles.infoHover}
                msgs={[
                  `Fetch the data directory for latest datasets every ${configValues.updateFrequency} seconds`,
                  "Data directory is set using the `dataset_path` environment variable",
                ]}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              min={5}
              max={1800}
              value={configValues.updateFrequency}
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
          <ListGroup.Item
            className={`${styles.listOfConfig} ${styles.noBaseMargin}`}
            key={"liveUpdates"}
          >
            <div className={styles.configTitle}>
              Live Updates
              <Trigger
                className={styles.infoHover}
                msg={`When turned on, fetch the data directory for latest datasets every ${configValues.updateFrequency} seconds`}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
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
            className={styles.listOfConfig}
            key={"hexHeightScale"}
          >
            <div className={styles.configTitle}>
              Hexagon Height
              <Trigger
                className={styles.infoHover}
                msg={`Adjust hexagon height, hold [shift] and drag on the main screen, to tilt the hexagons`}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
            <Slider
              className={`${styles.configSlider}`}
              min={1}
              max={100}
              value={config.hexHeight}
              onChange={(e) => updateConfig("hexHeight", e)}
              handleStyle={handleStyle}
              trackStyle={trackStyle}
              railStyle={railStyle}
              marks={{
                [config.hexHeight]: {
                  style: {
                    color: "white",
                  },
                  label: <span>{config.hexHeight}</span>,
                },
              }}
            />
          </ListGroup.Item>
          <ListGroup.Item
            className={`${styles.listOfConfig} ${styles.noBaseMargin}`}
            key={"3dPerspectiveLock"}
          >
            <div className={styles.configTitle}>
              3d Perspective Lock{" "}
              <Trigger
                className={styles.infoHover}
                msg={`When turned off, hold [shift] and drag on the main screen to tilt the hexagons in any direction`}
                iconName={"InfoCircle"}
              ></Trigger>
            </div>
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
