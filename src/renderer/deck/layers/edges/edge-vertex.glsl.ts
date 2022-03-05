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
#define SHADER_NAME edge

precision highp float;

uniform float numSegments;
uniform float strokeWidth;
uniform float opacity;
uniform int highlightedNode;
uniform int highlightedEdge;
uniform vec2 xPositionTexSize;
uniform vec2 yPositionTexSize;
uniform sampler2D xPositionTex;
uniform sampler2D yPositionTex;
// uniform sampler2D sourcePositionTex;
// uniform sampler2D targetPositionTex;
// uniform sampler2D bezierPositionTex;

in vec3 positions;
in int instanceId;
in ivec2 instanceEdge;
in ivec2 instanceBundle;
in vec4 instanceSourceColor;
in vec4 instanceTargetColor;
in vec3 instancePickingColors;
// in vec2 instanceSourcePosition;
// in vec2 instanceTargetPosition;
// in vec2 instanceBezierPosition;

out vec4 vColor;
out float vDiscard;

// offset vector by strokeWidth pixels
// offset_direction is -1 (left) or 1 (right)
vec2 getExtrusionOffset(vec2 line_clipspace, float offset_direction) {
    // normalized direction of the line
    vec2 dir_screenspace = normalize(line_clipspace * project_uViewportSize);
    // rotate by 90 degrees
    dir_screenspace = vec2(-dir_screenspace.y, dir_screenspace.x);
    // vec2 offset_screenspace = dir_screenspace * offset_direction * (strokeWidth * project_uScale) * .25;
    vec2 offset_screenspace = dir_screenspace * offset_direction * strokeWidth / 2.0;
    vec2 offset_clipspace = project_pixel_size_to_clipspace(offset_screenspace).xy;
    return offset_clipspace;
}

float getSegmentRatio(float index) {
    return smoothstep(0.0, 1.0, index / numSegments);
}

void main(void) {
    float edgeOffset = float(instanceBundle.x);
    float bundleSize = float(instanceBundle.y);
    int sourceNodeId = min(instanceEdge.x, instanceEdge.y);
    int targetNodeId = max(instanceEdge.x, instanceEdge.y);
    vec2 instanceSourcePosition = getNodePos(sourceNodeId, xPositionTex, yPositionTex, xPositionTexSize, yPositionTexSize);
    vec2 instanceTargetPosition = getNodePos(targetNodeId, xPositionTex, yPositionTex, xPositionTexSize, yPositionTexSize);
    // Compute the quadratic bezier control point for this edge
    vec2 instanceBezierPosition = computeControlPoint(
        instanceSourcePosition,
        instanceTargetPosition,
        edgeOffset / bundleSize
    );

    vDiscard = 0.;

    // Position
    vec2 source = project_common_position_to_clipspace(vec4(project_position(instanceSourcePosition), 0.0, 1.0)).xy;
    vec2 target = project_common_position_to_clipspace(vec4(project_position(instanceTargetPosition), 0.0, 1.0)).xy;
    vec2 anchor = project_common_position_to_clipspace(vec4(project_position(instanceBezierPosition), 0.0, 1.0)).xy;

    // linear interpolation of source & target to pick right coord
    float segmentIndex = positions.x;
    float segmentRatio = getSegmentRatio(segmentIndex);
    vec2 p0 = computeBezierCurve(source, target, anchor, segmentRatio);

    // next point
    float indexDir = mix(-1.0, 1.0, step(segmentIndex, 0.0));
    float nextSegmentRatio = getSegmentRatio(segmentIndex + indexDir);
    vec2 p2 = computeBezierCurve(source, target, anchor, nextSegmentRatio);

    // extrude
    float direction = positions.y;
    direction = mix(-1.0, 1.0, step(segmentIndex, 0.0)) * direction;
    vec2 offset = getExtrusionOffset(p2 - p0, direction);
    gl_Position = vec4(p0 + offset, 0.0, 1.0);

    // Color
    vColor = mix(instanceSourceColor, instanceTargetColor, segmentRatio);
    vColor = vec4(vColor.bgr, vColor.a * opacity) / 255.;

    // Set color to be rendered to picking fbo (also used to check for selection highlight).
    picking_setPickingColor(instancePickingColors);

    picking_vRGBcolor_Avalid.a = float(bool(picking_vRGBcolor_Avalid.a)
        // Highlight if this edge originates from the highlighted node
        || instanceEdge.x == highlightedNode
        // Highlight if this edge terminates at the highlighted node
        // || instanceEdge.y == highlightedNode
        // Highlight if this edge is the hovered/selected edge
        || instanceId == highlightedEdge
    );
}
`;
