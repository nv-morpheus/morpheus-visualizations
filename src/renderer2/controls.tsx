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

import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';

import * as React from 'react';

import { Accordion } from 'react-bootstrap';
import { Row, Col, Form, InputGroup, FloatingLabel } from 'react-bootstrap';
import { Button, ButtonGroup, ButtonToolbar } from 'react-bootstrap';
import RangeSlider from 'react-bootstrap-range-slider';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBackward, faForward, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'

import { DataCursor, LayoutParams } from '../types';

export interface ControlProps {
  style: any;
  dataCursor: DataCursor;
  autoCenter: boolean;
  layoutParams: LayoutParams;
  setDataCursor: (cursor: DataCursor) => void;
  setAutoCenter: (autoCenter: boolean) => void;
  setLayoutParams: (layoutParams: LayoutParams) => void;
}

const color = 'white';
const backgroundColor = 'rgba(0,0,0,0)';

export const Controls = ({
  style,
  autoCenter,
  dataCursor,
  layoutParams,
  setDataCursor,
  setAutoCenter,
  setLayoutParams,
}: ControlProps) => {

  const setLayoutParam = (key: keyof LayoutParams) => {
    return (val: any) => {
      setLayoutParams(new LayoutParams({ ...layoutParams, [key]: val }));
    };
  };

  return (
    <div style={{ width: 400, ...style }}>
      <Row style={{ color, backgroundColor }}>
        <Col sm={8}>
          <Form.Floating id="floatingTimeSlider">
            <label htmlFor="floatingTimeSlider"
              style={{ padding: 0, marginTop: -10, width: '100%', textAlign: 'center' }}>
              Time
            </label>
            <RangeSlider
              size="sm"
              min={0}
              max={100}
              step={1}
              value={0}
              tooltip="auto"
              tooltipPlacement="bottom"
              style={{ marginTop: 5, padding: 0 }}
              tooltipStyle={{ pointerEvents: 'none' }}
            // onChange={(ev) => onChange(Number(ev.target.value as any))}
            />
          </Form.Floating>
        </Col>
        <Col sm={4} style={{ paddingTop: 3 }}>
          <ButtonGroup size="sm">
            <Button
              variant="outline-light"
              onClick={() => setDataCursor('prev')}>
              <FontAwesomeIcon icon={faBackward} />
            </Button>
            <Button
              variant="outline-light"
              onClick={() => setDataCursor('next')}>
              <FontAwesomeIcon icon={faForward} />
            </Button>
          </ButtonGroup>
          <div style={{ display: 'inline-block', width: '5px' }} />
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => {
              if (dataCursor === 'play') {
                setDataCursor('stop');
              } else {
                setDataCursor('play');
                if (!layoutParams.active) {
                  setLayoutParams(new LayoutParams({ ...layoutParams, active: true }));
                }
              }
            }}>
            <FontAwesomeIcon icon={dataCursor === 'play' ? faPause : faPlay} />
            {/* {' '} */}
            {/* {dataCursor === 'play' ? "Pause" : "Play"} */}
          </Button>
        </Col>
      </Row>
      <Accordion style={{ color, backgroundColor }} flush={true}>
        <Accordion.Item style={{ color, backgroundColor }} eventKey="0">
          <Accordion.Button style={{ color, backgroundColor }}>
            Graph Layout Options
          </Accordion.Button>
          <Accordion.Body style={{ color, backgroundColor }}>
            <Form>
              <BooleanLayoutParam
                label="Simulating"
                checked={layoutParams.active}
                onChange={(active) => {
                  if (dataCursor === 'play') {
                    setDataCursor('stop');
                  }
                  setLayoutParams(new LayoutParams({ ...layoutParams, active }));
                }} />
              <BooleanLayoutParam label="Auto Center" checked={autoCenter} onChange={setAutoCenter} />
              <BooleanLayoutParam label="Strong Gravity" checked={layoutParams.strongGravityMode} onChange={setLayoutParam('strongGravityMode')} />
              <BooleanLayoutParam label="Strong Expansion" checked={layoutParams.linLogMode} onChange={setLayoutParam('linLogMode')} />
              <BooleanLayoutParam label="Dissuade Hubs" checked={layoutParams.outboundAttraction} onChange={setLayoutParam('outboundAttraction')} />
              <ContinuousLayoutParam label="Gravity Force" min={0} max={100} step={1} value={layoutParams.gravity} onChange={setLayoutParam('gravity')} />
              <ContinuousLayoutParam label="Expansion Force" min={0} max={100} step={1} value={layoutParams.scalingRatio} onChange={setLayoutParam('scalingRatio')} />
              <ContinuousLayoutParam label="Speed" min={0.0001} max={1} step={0.0001} value={layoutParams.jitterTolerance} onChange={setLayoutParam('jitterTolerance')} />
              <ContinuousLayoutParam label="Theta" min={0} max={0.001} step={0.0001} value={layoutParams.barnesHutTheta} onChange={setLayoutParam('barnesHutTheta')} />
              <ContinuousLayoutParam label="Edge Influence" min={0} max={100} step={1} value={layoutParams.edgeWeightInfluence} onChange={setLayoutParam('edgeWeightInfluence')} />
            </Form>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div >
  )
};

interface BooleanLayoutParamProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const BooleanLayoutParam = ({ label, checked, onChange }: BooleanLayoutParamProps) => {
  return (
    <Form.Group as={Row}>
      <Form.Label column sm={6}>{label}</Form.Label>
      <Col sm={6}>
        <Form.Check
          type="switch"
          checked={checked}
          style={{ marginTop: 7.5 }}
          onChange={(ev) => onChange(ev.target.checked)}
        />
      </Col>
    </Form.Group >
  );
}

interface ContinuousLayoutParamProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

const ContinuousLayoutParam = ({ min, max, step, label, value, onChange }: ContinuousLayoutParamProps) => {
  return (
    <Form.Group as={Row}>
      <Form.Label column sm={6}>{label}</Form.Label>
      <Col sm={6}>
        <RangeSlider
          size="sm"
          min={min}
          max={max}
          step={step}
          value={value}
          tooltip="auto"
          tooltipPlacement="top"
          style={{ marginTop: 5, padding: 0 }}
          tooltipStyle={{ pointerEvents: 'none' }}
          onChange={(ev) => onChange(Number(ev.target.value as any))}
        />
      </Col>
    </Form.Group >
  );
}
