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
import CloseButton from "react-bootstrap/CloseButton";
import ListGroup from "react-bootstrap/ListGroup";
import Ruler from "../ruler";
import Offcanvas from "react-bootstrap/Offcanvas";
import styles from "../../styles/components/sidePanels.module.css";
import Trigger from "../overlayTrigger";

async function requestJSON(type = "getEventByIndex", dataset, params = null) {
  let url = `/api/${type}?dataset=${dataset}&`;
  if (params != null) {
    url += `${params}`;
  }
  return await fetch(url, {
    method: "GET",
    headers: { "Access-Control-Allow-Origin": "*" },
  }).then((res) => res.json());
}

function getColorPaletteStyle(threshold) {
  return `linear-gradient(
    90deg,
    rgb(111, 111, 111, 1) ${threshold[0] * 100 - 1}%,
    rgba(255, 0, 0, 1) ${threshold[0] * 100}%,
    rgba(255, 255, 0, 1) ${threshold[1] * 100}%
  )`;
}

function SidePanel({ allEvents, anomalousColorThreshold, dataset }) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedEventData, setSelectedEventData] = useState({});
  const [attributes, setAttributes] = useState([]);
  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);

  useEffect(() => {
    setSelectedEventData({});
  }, [dataset]);

  useEffect(() => {
    const fetchData = async () => {
      if (dataset !== "") {
        const result = await requestJSON(
          "getEventByIndex",
          dataset,
          `index=${selectedEvent}`
        );
        if (result.result) {
          setSelectedEventData(result.result);
          setAttributes([
            ...new Set(
              Object.keys(result.result)
                .filter((w) => w.includes("_mean"))
                .map((w) => w.replace(/_score|_scaled|_mean/g, ""))
            ),
          ]);
        }
      }
    };
    fetchData().catch((e) => console.log(e));
  }, [selectedEvent]);

  useEffect(() => {
    if (allEvents.length > 0) {
      setSelectedEvent(allEvents[0].index);
      setShow(true);
    }
  }, [allEvents]);

  return (
    <div style={{ display: show ? "inline" : "none" }}>
      <Offcanvas
        id={styles.infoPanel}
        show={show}
        onHide={handleClose}
        placement={"end"}
      >
        <Offcanvas.Header>
          <Offcanvas.Title>Event Details</Offcanvas.Title>
          <CloseButton variant="white" onClick={() => setShow(false)} />
        </Offcanvas.Header>
        <ListGroup id={styles.infoPanelBody}>
          <label>
            <div className={styles.customHeader}>
              Selected Events{" "}
              <Trigger
                className={styles.infoHoverRightPanel}
                msg={"List of events, sorted by anomaly score"}
                iconName={"InfoCircle"}
                placement={"left"}
              ></Trigger>
            </div>
            <select
              name="events"
              id={styles.eventsDropDown}
              onChange={(e) => {
                setSelectedEvent(e.target.value);
              }}
              value={selectedEvent}
            >
              {allEvents.map((event) => (
                <option key={event.index} value={event.index}>
                  {parseFloat(event.anomalyScore_scaled).toFixed(3)} @ time:
                  {new Date(parseFloat(event.time)).toLocaleTimeString(
                    "en-US",
                    {
                      hour12: false,
                    }
                  )}
                  , Event[{event["index"]}]
                </option>
              ))}
            </select>
          </label>
          <br></br>
          <div className={styles.customHeader}>
            Anomalous Scale
            <Trigger
              className={styles.infoHoverRightPanel}
              msg={"Color palette for anomaly scores"}
              iconName={"InfoCircle"}
              placement={"left"}
            ></Trigger>
          </div>
          <div
            id={styles.colorBarAnomalousScale}
            style={{
              background: getColorPaletteStyle(anomalousColorThreshold),
            }}
          ></div>
          <div>
            <p className={styles.colorBarAxis}>0.0</p>{" "}
            <p className={styles.colorBarAxis} style={{ marginLeft: "40%" }}>
              0.5
            </p>{" "}
            <p className={styles.colorBarAxis} style={{ marginLeft: "35%" }}>
              1.0
            </p>
          </div>
          <div className={`${styles.customHeader} ${styles.underline}`}>
            Attributes
            <Trigger
              className={styles.infoHoverRightPanel}
              msg={"List of attributes impacting the anomaly score"}
              iconName={"InfoCircle"}
              placement={"left"}
            ></Trigger>
          </div>
          {["user", "time", "anomalyScore", "anomalyScore_scaled"].map(
            (attr) => (
              <ListGroup.Item
                className={styles.listOfAttributes}
                variant="dark"
                key={attr}
              >
                <span className={styles.selectedEventTitle}>
                  {attr.charAt(0).toUpperCase() + attr.slice(1)}:{" "}
                  <span
                    style={{
                      color:
                        attr == "anomalyScore_scaled" ? "#b95422" : "#f2f2f2",
                    }}
                  >
                    {selectedEventData ? (
                      ["anomalyScore_scaled", "anomalyScore"].includes(attr) ? (
                        parseFloat(selectedEventData[attr]).toFixed(3)
                      ) : attr == "time" ? (
                        new Date(
                          parseFloat(selectedEventData[attr])
                        ).toLocaleString("en-US", {
                          hour12: false,
                        })
                      ) : (
                        selectedEventData[attr]
                      )
                    ) : (
                      <></>
                    )}
                  </span>
                </span>
              </ListGroup.Item>
            )
          )}
          <br></br>
          {attributes.map((attr) => (
            <ListGroup.Item
              className={styles.listOfAttributes}
              variant="dark"
              key={attr}
            >
              <span className={styles.selectedEventTitle}>
                <u style={{ fontSize: 16 }}>{attr}</u>
                <br></br>
                raw score:{" "}
                <span className={styles.selectedEvent}>
                  {selectedEventData ? (
                    parseFloat(selectedEventData[attr + "_score"]).toFixed(3)
                  ) : (
                    <></>
                  )}
                </span>
                <br></br>scaled score:
                <Ruler
                  mean={
                    selectedEventData
                      ? selectedEventData[attr + "_score_scaled_mean"]
                      : 0
                  }
                  score={
                    selectedEventData
                      ? selectedEventData[attr + "_score_scaled"]
                      : 0
                  }
                />
              </span>
              <br></br>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Offcanvas>
    </div>
  );
}

export default SidePanel;
