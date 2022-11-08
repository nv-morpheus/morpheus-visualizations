import { Text } from "@react-three/drei";
import React from "react";

function TimeAxis3D({
  ticks = 48,
  timestamps = [],
  positionZ = -75,
  positionY = -50,
  lineHeight = 1.5,
  labelPositionIncrements = 400,
}) {
  return (
    <>
      {timestamps.map((timestamp, index) => {
        return (
          <React.Fragment key={timestamp + `_${index}`}>
            <Text
              key={timestamp + "_label"}
              scale={[1, 1, 1]}
              rotation={[-1.57, 0, 0]}
              color="white" // default
              fontSize={20}
              anchorY={"right"}
              position-x={
                index == timestamps.length - 1
                  ? index * labelPositionIncrements
                  : index * labelPositionIncrements + 177
              }
              position-z={positionY}
              lineHeight={lineHeight}
            >
              {index == timestamps.length - 1
                ? Array(1).fill("|        ").join("")
                : Array(9).fill("|        ").join("")}
            </Text>

            <Text
              key={timestamp}
              scale={[1, 1, 1]}
              rotation={[-1.57, 0, 0]}
              color="white" // default
              fontSize={18}
              anchorY={"right"}
              position-x={index * labelPositionIncrements}
              position-z={positionZ}
              lineHeight={1.5}
            >
              {new Date(timestamp).toLocaleTimeString("en-US", {
                hour12: false,
              })}
            </Text>
          </React.Fragment>
        );
      })}
    </>
  );
}

export default TimeAxis3D;
