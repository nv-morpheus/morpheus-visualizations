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
import { InfoCircle } from "react-bootstrap-icons";
import ListGroup from "react-bootstrap/ListGroup";
import Ruler from "../ruler";
import Offcanvas from "react-bootstrap/Offcanvas";
import styles from "../../styles/components/sidePanels.module.css";

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
          setSelectedEventData(result.result[0]);
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
              <a
                href="#"
                data-toggle="tooltip"
                title="List of events, sorted by anomaly score"
                data-original-placement="top"
              >
                <InfoCircle
                  color={"white"}
                  size={15}
                  style={{ float: "right" }}
                />
              </a>
            </div>
            <select
              name="events"
              id={styles.eventsDropDown}
              onChange={(e) => {
                console.log("event", e.target.value);
                setSelectedEvent(e.target.value);
              }}
              value={selectedEvent}
            >
              {allEvents.map((event) => (
                <option key={event.index} value={event.index}>
                  {parseFloat(event.anomaly_score).toFixed(3)} @ time:
                  {event.time}, Event[{event["index"]}]
                </option>
              ))}
            </select>
          </label>
          <br></br>
          <div className={styles.customHeader}>
            Anomalous Scale
            <a
              href="#"
              data-toggle="tooltip"
              title="Color palette for anomaly scores"
              data-original-placement="top"
            >
              <InfoCircle
                color={"white"}
                size={15}
                style={{ float: "right" }}
              />
            </a>
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
            <a
              href="#"
              data-toggle="tooltip"
              title="List of attributes impacting the anomaly score"
              data-original-placement="top"
            >
              <InfoCircle
                color={"white"}
                size={15}
                style={{ float: "right" }}
              />
            </a>
          </div>
          {["user", "time", "anomaly_score"].map((attr) => (
            <ListGroup.Item
              className={styles.listOfAttributes}
              variant="dark"
              key={attr}
            >
              <span className={styles.selectedEventTitle}>
                {attr.charAt(0).toUpperCase() + attr.slice(1)}:{" "}
                <span
                  style={{
                    color: attr == "anomaly_score" ? "#b95422" : "#f2f2f2",
                  }}
                >
                  {selectedEventData ? (
                    attr == "anomaly_score" ? (
                      parseFloat(selectedEventData[attr]).toFixed(3)
                    ) : (
                      selectedEventData[attr]
                    )
                  ) : (
                    <></>
                  )}
                </span>
              </span>
            </ListGroup.Item>
          ))}
          <br></br>
          {[
            "appDisplayName",
            "appincrement",
            "clientAppUsed",
            "deviceDetailbrowser",
            "locationcity",
            "locationcountryOrRegion",
          ].map((attr) => (
            <ListGroup.Item
              className={styles.listOfAttributes}
              variant="dark"
              key={attr}
            >
              <span className={styles.selectedEventTitle}>
                {attr}:{" "}
                <span className={styles.selectedEvent}>
                  {selectedEventData ? (
                    attr == "anomaly_score" ? (
                      parseFloat(selectedEventData[attr]).toFixed(3)
                    ) : (
                      selectedEventData[attr]
                    )
                  ) : (
                    <></>
                  )}
                </span>
                <Ruler
                  mean={
                    selectedEventData
                      ? selectedEventData[attr + "_score_scaled"]
                      : 0
                  }
                  score={
                    selectedEventData ? selectedEventData[attr + "_score"] : 0
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
