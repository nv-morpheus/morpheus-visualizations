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

export default `\
#version 300 es
precision highp float;
precision highp sampler2D;

// returns id's pixel indeces [x, y],
// where x ranges in [0 to texSize-1] and y ranges in [0 to texSize-1]
vec2 bufTex_indices(float id, float texWidth, float halfPixelY) {
    // Add safe offset (half of pixel height) before doing floor
    float yIndex = floor((id / texWidth) + halfPixelY);
    float xIndex = id - (yIndex * texWidth);
    return vec2(xIndex, yIndex);
}

// returns id's texture coordianate
vec2 bufTex_coord(float id, vec2 size) {
    // half of pixel size, used to move the pixel position to center of the pixel.
    vec2 halfPixelSize = vec2(1.) / (2. * size);
    vec2 indices = bufTex_indices(id, size.x, halfPixelSize.y);
    vec2 coord = indices / size + halfPixelSize;
    return coord;
}

// returns id's texture position
vec2 bufTex_pos(float id, vec2 size) {
    /* Change from [0 1] range to [-1 1] */
    return (bufTex_coord(id, size) * (2.0, 2.0)) - (1., 1.);
}
vec2 bufTex_pos(int id, vec2 size) { return bufTex_pos(float(id), size); }
vec2 bufTex_pos(uint id, vec2 size) { return bufTex_pos(float(id), size); }

// returns id's pixel value
vec4 bufTex_get(float id, sampler2D tex, vec2 texSize) { return texture(tex, bufTex_coord(id, texSize)); }
// returns id's pixel value
vec4 bufTex_get(int id, sampler2D tex, vec2 texSize) { return bufTex_get(float(id), tex, texSize); }
// returns id's pixel value
vec4 bufTex_get(uint id, sampler2D tex, vec2 texSize) { return bufTex_get(float(id), tex, texSize); }

vec2 bufTex_getXY(int i, sampler2D tex, vec2 texSize) {
    vec4 v = bufTex_get(i / 2, tex, texSize);
    return i % 2 == 0 ? v.xy : v.zw;
}

vec2 getNodePos(int id, sampler2D xPos, sampler2D yPos, vec2 xSize, vec2 ySize) {
    float x = bufTex_get(id / 4, xPos, xSize)[id % 4];
    float y = bufTex_get(id / 4, yPos, ySize)[id % 4];
    return vec2(x, y);
}

vec2 getNodePos(float id, sampler2D xPos, sampler2D yPos, vec2 xSize, vec2 ySize) {
    return getNodePos(int(id), xPos, yPos, xSize, ySize);
}

vec2 computeControlPoint(vec2 sPos, vec2 tPos, float ratio) {
    vec2 midp = (tPos + sPos) * .5;
    vec2 diff = normalize(tPos - sPos);
    vec2 unit = vec2(-diff.y, diff.x);
    float direction = 1.0; // all edges will bend in the same direction
    // curve radius is 12.5% - 37.5% distance between src and dst nodes
    float curveRadius = length(tPos - sPos) * 0.25;
    float size = mix(
        curveRadius * 0.5,
        curveRadius * 1.5,
        ratio
    );
    return midp + (unit * size * direction);
}

vec2 computeBezierCurve(vec2 source, vec2 target, vec2 cpoint, float ratio) {
    float mt = 1.0 - ratio;
    float mt2 = pow(mt, 2.0);
    float t2 = pow(ratio, 2.0);
    // quadratic curve
    float a = mt2;
    float b = mt * ratio * 2.0;
    float c = t2;
    return vec2(
        a * source.x + b * cpoint.x + c * target.x,
        a * source.y + b * cpoint.y + c * target.y
    );
}

// out vec4 x;
`;
