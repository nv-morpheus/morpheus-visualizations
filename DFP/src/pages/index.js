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

import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from "react-bootstrap/Navbar";
import Spinner from "react-bootstrap/Spinner";
import React from "react";
import { tableFromIPC } from "apache-arrow";
import Image from "next/image";
import { HexGrid3d } from "../components/hexgrid-3d";
import AreaChart from "../components/area";
import SidePanel from "../components/sidePanels/rightInfoPanel";
import ConfigPanel from "../components/sidePanels/leftConfigPanel";
import styles from "../styles/index.module.css";

async function requestJSON(type = "getEventStats", params = null) {
  let url = `/api/${type}?`;
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

async function requestData(type = "getDF", params = null) {
  let url = `/api/${type}?`;
  if (params != null) {
    url += `${params}`;
  }
  const result = await fetch(url, {
    method: "GET",
    headers: { "Access-Control-Allow-Origin": "*" },
  });
  const table = tableFromIPC(result);
  return table;
}

export default class CustomD3 extends React.Component {
  constructor(props) {
    super(props);
    this.svg = React.createRef();
    this.areaRef = React.createRef();
    this.tooltipRef = React.createRef();
    this.legendRef = React.createRef();
    this.resetSelected = this.resetSelected.bind(this);
    this.updateAppSettings = this.updateAppSettings.bind(this);
    this.appendPayload = this.appendPayload.bind(this);
    this.setLoadingIndicator = this.setLoadingIndicator.bind(this);
    this.loadData = this.loadData.bind(this);
    this.setEvents = this.setEvents.bind(this);
    this.setSelectedEvent = this.setSelectedEvent.bind(this);
    this.promisedSetState = this.promisedSetState.bind(this);
    this.reload = this.reload.bind(this);
    this.offsetX = 200;
    this.offsetY = 100;
    this.hexRadius = 20;
    this.hexgridWidth = 1600;
    this.hexgridHeight = this.hexRadius * 50;
    this.state = {
      selectedEvent: { userID: -1, time: -1 },
      selectedInstance: -1,
      allEvents: [],
      play: true,
      position: new Float32Array(),
      timestamps: [],
      colors: new Float32Array(),
      userIDs: new Float32Array(),
      totalEvents: [],
      anomalousEvents: [],
      AppSettings: {
        currentDataset: "",
        sort: true,
        sortBy: "sum",
        anomalousColorThreshold: eval(
          process.env.NEXT_PUBLIC_anomaly_color_threshold
        ),
        liveUpdates: true,
        lastUpdated: null,
        threeDimensionPerspectiveLock: true,
        visibleUsers: {
          min: 2,
          max: process.env.NEXT_PUBLIC_visible_users_max,
          value: process.env.NEXT_PUBLIC_visible_users,
        },
        lookBackTime: parseInt(process.env.NEXT_PUBLIC_look_back_time),
        lookBackTimeRange: eval(process.env.NEXT_PUBLIC_look_back_time_range),
        timePerHex: parseInt(process.env.NEXT_PUBLIC_time_bin_per_hex),
        totalTime: 48,
        hexHeight: 1,
      },
      notifications: "",
      loading: false,
    };
  }

  appendPayload() {
    return `dataset=${this.state.AppSettings.currentDataset}&sort=${this.state.AppSettings.sort}&sortBy=${this.state.AppSettings.sortBy}&numUsers=${this.state.AppSettings.visibleUsers.value}&lookBackTime=${this.state.AppSettings.lookBackTime}&timePerHexBin=${this.state.AppSettings.timePerHex}`;
  }

  async loadData() {
    const data = await requestJSON(
      "getEventStats",
      `${this.appendPayload()}&anomalyThreshold=${
        this.state.AppSettings.anomalousColorThreshold[1]
      }`
    );
    const elevation = await requestData("getDFElevation", this.appendPayload());

    const colors = await requestData(
      "getDFColors",
      `${this.appendPayload()}&colorThreshold=${
        this.state.AppSettings.anomalousColorThreshold
      }`
    );
    const timestamps = await requestJSON("getTimeStamps", this.appendPayload());
    const userIDs = await requestData("getUniqueIDs", this.appendPayload());
    const totalTime = await requestJSON("getTotalTime", this.appendPayload());
    this.setState({
      position: elevation.batches[0].data.children[0].values,
      colors: colors.batches[0].data.children[0].values,
      userIDs: new TextDecoder().decode(
        userIDs.batches[0].data.children[0].values
      ),
      anomalousEvents: data.anomalousEvents,
      totalEvents: data.totalEvents,
      selectedEvent: {
        ...this.state.selectedEvent,
        instanceId: -1,
      },
      timestamps: timestamps.timeStamps,
      AppSettings: {
        ...this.state.AppSettings,
        totalTime: parseInt(totalTime),
        lastUpdated: new Date().toLocaleString(),
      },
    });
    if (
      this.state.AppSettings.lookBackTime <
      this.state.AppSettings.lookBackTimeRange[1]
    ) {
      this.setState({
        notifications:
          "Not all data is visible at the moment (toggle the following settings: Look Back Time, Time Bin Per Hexagon)",
      });
    } else {
      this.setState({
        notifications: "new data loaded successfully",
      });
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    if (
      prevState.AppSettings.currentDataset == "" &&
      prevState.AppSettings.currentDataset !==
        this.state.AppSettings.currentDataset
    ) {
      // load the dataset the first time app is loaded
      await this.reload();
    }
  }
  promisedSetState(newState) {
    return new Promise((resolve) => this.setState(newState, resolve));
  }

  async reload(configValues = {}) {
    const numUsers = await requestJSON(
      "getNumUsers",
      `dataset=${
        configValues.currentDataset || this.state.AppSettings.currentDataset
      }`
    );
    const lookBackTimeMax = await requestJSON(
      "getTotalLookBackTime",
      `dataset=${
        configValues.currentDataset || this.state.AppSettings.currentDataset
      }`
    );

    const lookBackTimeRange = [
      this.state.AppSettings.lookBackTimeRange[0],
      lookBackTimeMax,
    ];

    let lookBackTime = parseInt(process.env.NEXT_PUBLIC_look_back_time);
    let timePerHex = parseInt(process.env.NEXT_PUBLIC_time_bin_per_hex);

    const visibleUsers = {
      min: this.state.AppSettings.visibleUsers.min,
      max: numUsers.numUsers,
      value: Math.min(
        numUsers.numUsers,
        parseInt(process.env.NEXT_PUBLIC_visible_users_max)
      ),
    };

    let anomalousColorThreshold =
      this.state.AppSettings.anomalousColorThreshold;

    if (configValues.currentDataset == this.state.AppSettings.currentDataset) {
      visibleUsers.value = configValues.visibleUsers.value;
      lookBackTime = configValues.lookBackTime;
      timePerHex = configValues.timePerHex;
      anomalousColorThreshold = configValues.colorThreshold.map((x) => x / 100);
    }

    await this.promisedSetState({
      AppSettings: {
        ...this.state.AppSettings,
        visibleUsers,
        currentDataset:
          configValues.currentDataset || this.state.AppSettings.currentDataset,
        lookBackTimeRange,
        lookBackTime,
        timePerHex,
        anomalousColorThreshold,
      },
    });

    await this.loadData();
    this.setLoadingIndicator(false);
  }

  resetSelected() {
    this.setState({
      selectedEvent: -1,
    });
    this.setState({
      notifications: "selections reset",
    });
  }

  setEvents(events) {
    this.setState({
      allEvents: events,
    });
    if (events.length == 0) {
      this.setState({
        notifications: "No events found",
      });
    } else {
      this.setState({
        notifications: "Events retrieved",
      });
    }
  }

  async setSelectedEvent(event) {
    this.setState({
      selectedEvent: event,
    });
  }

  setLoadingIndicator(value) {
    this.setState({
      loading: value,
    });
  }

  async updateAppSettings(key, value) {
    this.promisedSetState({
      AppSettings: {
        ...this.state.AppSettings,
        [key]: value,
      },
    });
  }

  render() {
    return (
      <div id="chart">
        <div className={styles.topnav}>
          <ConfigPanel
            config={this.state.AppSettings}
            updateConfig={this.updateAppSettings}
            reloadCharts={this.reload}
            setLoadingIndicator={this.setLoadingIndicator}
            loading={this.state.loading}
          />
          <span> MORPHEUS | Digital Fingerprint </span>
          <div style={{ float: "right", margin: "0" }}>
            <Image
              alt="nv_logo"
              src="/nvidia-logo-final.png"
              height={50}
              width={75}
            ></Image>
          </div>
        </div>
        <Navbar fixed="bottom" className={styles.bottomnav}>
          <div className={styles.bottomnavCredits}>
            <span>Visualization Powered by Node Rapids</span>
          </div>
          <div className={styles.bottomnavNotifications}>
            <span>
              {this.state.notifications} &nbsp;&nbsp;&nbsp; |&nbsp;&nbsp;&nbsp;
              Live Updates: {this.state.AppSettings.liveUpdates ? "On" : "Off"}{" "}
              &nbsp;&nbsp;&nbsp; |&nbsp;&nbsp;&nbsp; Last Updated:{" "}
              {this.state.AppSettings.lastUpdated || ""}
            </span>
          </div>
          {this.state.loading ? (
            <Spinner
              animation="border"
              variant="light"
              size="sm"
              className={styles.loadingIcon}
            />
          ) : null}
        </Navbar>

        <div id={styles.area}>
          <AreaChart
            totalEvents={this.state.totalEvents}
            anomalousEvents={this.state.anomalousEvents}
          />
        </div>
        <div id={styles.hexgrid}>
          <HexGrid3d
            position={this.state.position}
            colors={this.state.colors}
            userIDs={this.state.userIDs}
            setEvents={this.setEvents}
            setSelectedEvent={this.setSelectedEvent}
            selectedEvent={this.state.selectedEvent}
            resetSelected={this.resetSelected}
            appSettings={this.state.AppSettings}
            setLoadingIndicator={this.setLoadingIndicator}
            timestamps={this.state.timestamps}
            currentDataset={this.state.AppSettings.currentDataset}
            hexHeight={this.state.AppSettings.hexHeight}
          />

          <SidePanel
            allEvents={this.state.allEvents}
            anomalousColorThreshold={
              this.state.AppSettings.anomalousColorThreshold
            }
            dataset={this.state.AppSettings.currentDataset}
          ></SidePanel>
        </div>
      </div>
    );
  }
}
