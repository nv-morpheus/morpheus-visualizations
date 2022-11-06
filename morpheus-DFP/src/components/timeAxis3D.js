import { Text } from "@react-three/drei";

function TimeAxis3D({
  ticks = 48,
  timestamps = [],
  positionX = 812,
  positionY = -50,
  lineHeight = 1.5,
  labelPositionIncrements = 400,
}) {
  return (
    <>
      <Text
        scale={[1, 1, 1]}
        rotation={[-1.57, 0, 0]}
        color="white" // default
        fontSize={20}
        anchorY={"right"}
        position-x={positionX}
        position-z={positionY}
        lineHeight={lineHeight}
      >
        {Array(ticks).fill("|      ").join("")}
      </Text>
      {timestamps.map((timestamp, index) => {
        return (
          <Text
            key={timestamp}
            scale={[1, 1, 1]}
            rotation={[-1.57, 0, 0]}
            color="white" // default
            fontSize={18}
            anchorY={"right"}
            position-x={index * labelPositionIncrements}
            position-z={-75}
            lineHeight={1.5}
          >
            {new Date(timestamp).toLocaleTimeString("en-US", {
              hour12: false,
            })}
          </Text>
        );
      })}
    </>
  );
}

export default TimeAxis3D;