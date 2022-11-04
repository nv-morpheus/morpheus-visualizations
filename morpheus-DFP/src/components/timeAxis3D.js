import { Text } from "@react-three/drei";

function TimeAxis3D({ ticks = 48, timestamps = [] }) {
  console.log(timestamps);
  return (
    <>
      <Text
        scale={[1, 1, 1]}
        rotation={[-1.57, 0, 0]}
        color="white" // default
        fontSize={20}
        anchorY={"right"}
        position-x={812}
        position-z={-50}
        lineHeight={1.5}
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
            position-x={index * 400}
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
