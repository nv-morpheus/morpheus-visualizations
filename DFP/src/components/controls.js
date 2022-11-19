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

import React, { useRef } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";

import { MapControls } from "three/examples/jsm/controls/OrbitControls";

extend({ MapControls });

function Controls(props) {
  const controls = useRef();
  const { camera, gl } = useThree();
  useFrame(() => {
    controls.current.update();
  });
  return (
    <mapControls
      ref={controls}
      args={[camera, gl.domElement]}
      enableDamping={false}
      dampingFactor={0}
      minDistance={0}
      maxDistance={1500}
      maxPolarAngle={Math.PI / 2}
      {...props}
    />
  );
}

export default Controls;
