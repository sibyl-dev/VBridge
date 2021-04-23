import * as d3 from "d3";
import * as _ from 'lodash';
import * as React from 'react';
import { IMargin } from "./common";

export interface ChartStyle {
    width: number,
    height: number,
    margin?: IMargin,
}