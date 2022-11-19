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
#define SHADER_NAME node

uniform bool filled;
uniform float stroked;
uniform float fillOpacity;
uniform float strokeRatio;
uniform float strokeOpacity;
uniform float radiusScale;
uniform float radiusMinPixels;
uniform float radiusMaxPixels;
uniform float lineWidthScale;
uniform float lineWidthMinPixels;
uniform float lineWidthMaxPixels;
uniform int highlightedNode;
uniform int highlightedSourceNode;
uniform int highlightedTargetNode;
uniform sampler2D xPositionTex;
uniform sampler2D yPositionTex;
uniform vec2 xPositionTexSize;
uniform vec2 yPositionTexSize;

in vec3 positions;
in int instanceId;
in float instanceRadius;
// in float instanceLineWidths;
in vec4 instanceFillColor;
in vec4 instanceLineColor;
// in float instanceXPosition;
// in float instanceYPosition;
// in float instanceXPosition64Low;
// in float instanceYPosition64Low;
in vec3 instancePickingColors;

out vec4 vFillColor;
out vec4 vLineColor;
out vec2 unitPosition;
out float innerUnitRadius;
out float outerRadiusPixels;

void main(void) {

    float instanceXPosition = bufTex_get(instanceId / 4, xPositionTex, xPositionTexSize)[instanceId % 4];
    float instanceYPosition = bufTex_get(instanceId / 4, yPositionTex, yPositionTexSize)[instanceId % 4];
    float instanceXPosition64Low = 0.0;
    float instanceYPosition64Low = 0.0;

    geometry.worldPosition = vec3(instanceXPosition, instanceYPosition, 0.);

    // Multiply out radius and clamp to limits
    outerRadiusPixels = project_size_to_pixel(instanceRadius * radiusScale);
    outerRadiusPixels = clamp(outerRadiusPixels, radiusMinPixels, radiusMaxPixels);

    // Multiply out line width and clamp to limits
    float lineWidthPixels = 0.;
    lineWidthPixels = outerRadiusPixels * strokeRatio * lineWidthScale;
    lineWidthPixels = clamp(lineWidthPixels, lineWidthMinPixels, lineWidthMaxPixels);

    // outer radius needs to offset by half stroke width
    outerRadiusPixels += stroked * lineWidthPixels / 2.0;

    // position on the containing square in [-1, 1] space
    unitPosition = positions.xy;
    geometry.uv = unitPosition;
    geometry.pickingColor = instancePickingColors;

    innerUnitRadius = 1.0 - stroked * lineWidthPixels / outerRadiusPixels;

    vec3 offset = positions * project_pixel_size(outerRadiusPixels);
    DECKGL_FILTER_SIZE(offset, geometry);
    gl_Position = project_position_to_clipspace(
        vec3(instanceXPosition, instanceYPosition, 0.),
        vec3(instanceXPosition64Low, instanceYPosition64Low, 0.),
        offset, geometry.position
    );
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

    // Apply opacity to instance color, or return instance picking color
    vFillColor = vec4(instanceFillColor.bgr, fillOpacity);
    DECKGL_FILTER_COLOR(vFillColor, geometry);
    vLineColor = vec4(instanceLineColor.bgr, strokeOpacity);
    DECKGL_FILTER_COLOR(vLineColor, geometry);

    picking_vRGBcolor_Avalid.a = float(
        bool(picking_vRGBcolor_Avalid.a) ||
        instanceId == highlightedNode ||
        instanceId == highlightedSourceNode ||
        instanceId == highlightedTargetNode );
}
`;
