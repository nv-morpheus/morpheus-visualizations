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

import styles from "../styles/components/ruler.module.css";

function Ruler({ mean, score }) {
  const min = Math.min(mean, score);
  const max = Math.max(mean, score);
  return (
    <div>
      <span
        className={styles.rulerLabel}
        style={{
          marginLeft: `${score * 100}%`,
        }}
      >
        Score({parseFloat(score).toFixed(2)})
      </span>

      <div className={styles.ruler}>
        {[...Array(100)].map((e, i) => (
          <div
            key={i}
            className={
              i / 100 >= min && i / 100 <= max
                ? `${styles.rulerRule} ${styles.rulerBG}`
                : styles.rulerRule
            }
          ></div>
        ))}
      </div>
      <div
        className={styles.rulerLabel}
        style={{
          marginLeft: `${mean * 100}%`,
        }}
      >
        Mean({parseFloat(mean).toFixed(2)})
      </div>
    </div>
  );
}

export default Ruler;
