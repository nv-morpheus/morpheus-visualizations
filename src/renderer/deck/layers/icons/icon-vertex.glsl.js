// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import common_vs from '../../../common.vs.glsl';

export default `\
${common_vs}
#define SHADER_NAME icon

in vec2 positions;

in int instanceEdge;
in int instanceIcon;
in float instanceAge;
in float instanceSize;
// in vec2 instancePosition;
in vec3 instancePickingColor;

uniform float sizeScale;
uniform vec2 iconsTextureDim;
uniform float sizeMinPixels;
uniform float sizeMaxPixels;
uniform bool billboard;
uniform int sizeUnits;
uniform float maxAge;

uniform sampler2D edgeTex;
uniform sampler2D bundleTex;
uniform sampler2D xPositionTex;
uniform sampler2D yPositionTex;
uniform sampler2D iconAtlasFrameTex;
uniform sampler2D iconAtlasOffsetTex;

uniform vec2 edgeTexSize;
uniform vec2 bundleTexSize;
uniform vec2 xPositionTexSize;
uniform vec2 yPositionTexSize;
uniform vec2 iconAtlasFrameTexSize;
uniform vec2 iconAtlasOffsetTexSize;

out vec4 vColor;
out vec2 vTextureCoords;
out vec2 uv;

vec2 rotate_by_angle(vec2 vertex, float angle) {
    float angle_radian = angle * PI / 180.0;
    float cos_angle = cos(angle_radian);
    float sin_angle = sin(angle_radian);
    mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
    return rotationMatrix * vertex;
}

void main(void) {

    vec2 edge = bufTex_getXY(instanceEdge, edgeTex, edgeTexSize);
    vec2 bundle = bufTex_getXY(instanceEdge, bundleTex, bundleTexSize);
    vec2 instanceSourcePosition = getNodePos(edge.x, xPositionTex, yPositionTex, xPositionTexSize, yPositionTexSize);
    vec2 instanceTargetPosition = getNodePos(edge.y, xPositionTex, yPositionTex, xPositionTexSize, yPositionTexSize);
    // Compute the quadratic bezier control point for this edge
    vec2 instanceBezierPosition = computeControlPoint(
        instanceSourcePosition,
        instanceTargetPosition,
        bundle.x / bundle.y
    );
    vec2 instancePosition = computeBezierCurve(
        instanceSourcePosition,
        instanceTargetPosition,
        instanceBezierPosition,
        smoothstep(0.0, maxAge, instanceAge)
        // instanceAge / maxAge * step(0.0, instanceAge)
    );

    float instanceAngle = 0.;
    vec2 instanceOffset = bufTex_getXY(instanceIcon, iconAtlasOffsetTex, iconAtlasOffsetTexSize);
    vec4 instanceIconFrame = bufTex_get(instanceIcon, iconAtlasFrameTex, iconAtlasFrameTexSize);
    vec2 instancePixelOffset = instanceOffset;

    vec4 pos = vec4(instancePosition, 0., 1.);
    vec4 pos64Low = vec4(0.);
    geometry.worldPosition = pos.xyz;
    geometry.uv = positions;
    geometry.pickingColor = instancePickingColor;
    uv = positions;

    vec2 iconSize = instanceIconFrame.zw;
    // convert size in meters to pixels, then scaled and clamp

    // project meters to pixels and clamp to limits
    float sizePixels = clamp(
        project_size_to_pixel(max(instanceSize, 1.0) * sizeScale, sizeUnits),
        sizeMinPixels, sizeMaxPixels
    );

    // scale icon height to match instanceSize
    float instanceScale = iconSize.y == 0.0 ? 0.0 : sizePixels / iconSize.y;

    // scale and rotate vertex in "pixel" value and convert back to fraction in clipspace
    vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffset;
    pixelOffset = rotate_by_angle(pixelOffset, instanceAngle) * instanceScale;
    pixelOffset -= (instancePixelOffset * instanceScale);
    pixelOffset.y *= -1.0;

    if (billboard)  {
        gl_Position = project_position_to_clipspace(pos.xyz, pos64Low.xyz, vec3(0.0), geometry.position);
        vec3 offset = vec3(pixelOffset, 0.0);
        DECKGL_FILTER_SIZE(offset, geometry);
        gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);

    } else {
        vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
        DECKGL_FILTER_SIZE(offset_common, geometry);
        gl_Position = project_position_to_clipspace(pos.xyz, pos64Low.xyz, offset_common, geometry.position);
    }
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

    vTextureCoords = mix(
        instanceIconFrame.xy,
        instanceIconFrame.xy + iconSize,
        (positions.xy + 1.0) / 2.0
    ) / iconsTextureDim;

    vColor = vec4(1., 1., 1., step(0.0, instanceAge));

    DECKGL_FILTER_COLOR(vColor, geometry);
}
`;
