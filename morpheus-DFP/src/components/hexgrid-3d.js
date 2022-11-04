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

/* eslint-disable react/no-unknown-property */

import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrthographicCamera, MapControls } from "@react-three/drei";
import { Text } from "@react-three/drei";
import TimeAxis3D from "./timeAxis3D";
import styles from "../styles/components/hexgrid.module.css";

async function requestJSON(type = "getInstances", dataset, params = null) {
  let url = `/api/${type}?dataset=${dataset}&`;
  if (params != null) {
    url += `${params}`;
  }
  return await fetch(url, {
    method: "GET",
    headers: { "Access-Control-Allow-Origin": "*" },
  }).then((res) => res.json());
}
function HexGrid3dBase({
  appSettings,
  hexRadius,
  timestamps,
  position,
  colors,
  userIDs,
  setLoadingIndicator,
  selectedEvent,
  setSelectedEvent,
  currentDataset,
  setEvents,
}) {
  const myMesh = useRef();
  const globalMesh = useRef();
  const [previousSelectedEvent, setPreviousSelectedEvent] = useState({
    instanceId: -1,
  });

  useEffect(() => {
    myMesh.current.instanceMatrix = new THREE.InstancedBufferAttribute(
      position,
      16
    );
  }, [position]);

  useEffect(() => {
    if (selectedEvent.instanceId != -1) {
      position[previousSelectedEvent.instanceId * 16 + 0] = 1;
      position[previousSelectedEvent.instanceId * 16 + 10] = 1;
      position[selectedEvent.instanceId * 16 + 0] = 0.7;
      position[selectedEvent.instanceId * 16 + 10] = 0.7;
      setPreviousSelectedEvent(selectedEvent);
    }
  }, [position, previousSelectedEvent.instanceId, selectedEvent]);

  return (
    <mesh
      ref={globalMesh}
      position={[200 - window.innerWidth / 2, 0, 80 - window.innerHeight / 2]}
    >
      <instancedMesh
        ref={myMesh}
        args={[
          null,
          null,
          appSettings.visibleUsers.value * appSettings.lookBackTime,
        ]}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "default";
        }}
        onClick={async (e) => {
          e.stopPropagation();
          setLoadingIndicator(true);
          const id = e.instanceId;
          if (id !== selectedEvent.instanceId) {
            const result = await requestJSON(
              "getInstances",
              currentDataset,
              `id=${id}&sort=${appSettings.sort}&sortBy=${appSettings.sortBy}`
            );
            setEvents(result["result"]);
            await setSelectedEvent({
              ...result["result"][0],
              instanceId: id,
            });
          } else {
            setSelectedEvent({
              userID: -1,
              time: -1,
              instanceId: -1,
            });
          }
          setLoadingIndicator(false);
        }}
      >
        <cylinderGeometry
          attach="geometry"
          args={[hexRadius - 4, hexRadius - 4, 1, 6, 1]}
        >
          <instancedBufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </cylinderGeometry>
        <meshPhongMaterial vertexColors />
      </instancedMesh>
      <Text
        scale={[1, 1, 1]}
        rotation={[-1.57, 0, 0]}
        color="white" // default
        fontSize={20}
        maxWidth={140}
        anchorY={"right"}
        position-x={-100}
        position-z={-14}
        lineHeight={1.5}
      >
        {userIDs}
      </Text>
      <TimeAxis3D
        ticks={appSettings.lookBackTime}
        timestamps={timestamps}
      ></TimeAxis3D>
    </mesh>
  );
}

export function HexGrid3d({
  appSettings,
  hexRadius,
  timestamps,
  position,
  colors,
  userIDs,
  setLoadingIndicator,
  selectedEvent,
  setSelectedEvent,
  currentDataset,
  setEvents,
  resetSelected,
}) {
  const controlsRef = useRef();
  const cameraRef = useRef();
  const [args, setArgs] = useState([0, 0, 0, 0, 0, 0]);
  const cameraPostion = [0, 500, 4];

  function resetControls() {
    controlsRef.current && controlsRef.current.reset();
    cameraRef.current && (cameraRef.current.zoom = 1);
    resetSelected();
  }

  useEffect(() => {
    setArgs([
      window.innerWidth / -2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      -5000,
      5000,
    ]);
  }, []);

  useEffect(() => {
    if (appSettings.threeDimensionPerspectiveLock) {
      controlsRef.current && controlsRef.current.reset();
      cameraRef.current && (cameraRef.current.zoom = 1);
      resetSelected();
    }
  }, [appSettings.threeDimensionPerspectiveLock, resetSelected]);

  return (
    <div id={styles.hexBox}>
      <Canvas
        id={styles.hexgridCanvas}
        linear={true}
        onDoubleClick={resetControls}
      >
        <color attach="background" args={["#333"]} />
        <ambientLight color={0xffffff} />
        <directionalLight position={[300, 200, 1]} color={0xffffff} />
        <directionalLight position={[300, 1, 1]} color={0xffffff} />
        <directionalLight position={[1, 200, 1]} color={0xffffff} />

        {currentDataset != "" ? (
          <HexGrid3dBase
            hexRadius={20}
            position={position}
            colors={colors}
            userIDs={userIDs}
            setEvents={setEvents}
            setSelectedEvent={setSelectedEvent}
            selectedEvent={selectedEvent}
            setLoadingIndicator={setLoadingIndicator}
            appSettings={appSettings}
            timestamps={timestamps}
            currentDataset={currentDataset}
          />
        ) : (
          <></>
        )}

        <MapControls
          makeDefault
          screenSpacePanning={true}
          ref={controlsRef}
          minDistance={0}
          maxDistance={5000}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={
            appSettings.threeDimensionPerspectiveLock ? 0 : Math.PI / 2
          }
          maxAzimuthAngle={0}
        />
        <OrthographicCamera
          makeDefault
          ref={cameraRef}
          zoom={1}
          position={cameraPostion}
          args={args}
        />
      </Canvas>
    </div>
  );
}
