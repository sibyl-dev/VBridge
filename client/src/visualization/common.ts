import * as d3 from "d3";
import * as _ from 'lodash';
import { CSSProperties } from "react";

function colors(specifier: string) {
  let n = specifier.length / 6 | 0, colors: string[] = new Array(n), i = 0;
  while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
  return colors;
}

export const schemeTableau10 = colors("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

export const defaultCategoricalColor = (i: number) => schemeTableau10[i % schemeTableau10.length];

export interface IMargin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type MarginType = number | Partial<IMargin>;

export const defaultMarginLeft = 15,
  defaultMarginRight = 15,
  defaultMarginTop = 2,
  defaultMarginBottom = 2;

export const defaultMargin = {
  top: defaultMarginTop,
  bottom: defaultMarginBottom,
  left: defaultMarginLeft,
  right: defaultMarginRight
};

export function getMargin(margin: MarginType): IMargin {
  if (typeof margin === "number") {
    return { top: margin, bottom: margin, left: margin, right: margin };
  } else {
    return {
      top: defaultMarginTop,
      bottom: defaultMarginBottom,
      left: defaultMarginLeft,
      right: defaultMarginRight,
      ...margin
    };
  }
}

export type PropertyValueFn<T, E extends d3.BaseType, Datum, Result> = {
  [P in keyof T]: Result | d3.ValueFn<E, Datum, Result>;
};

export type CSSPropertiesFn<E extends d3.BaseType, Datum> = PropertyValueFn<
  CSSProperties,
  E,
  Datum,
  string | number
>;

export interface ChartOptions {
  width: number;
  height: number;
  margin: MarginType;
}

export function getChildOrAppend<
  GElement extends d3.BaseType,
  PElement extends d3.BaseType
>(root: d3.Selection<PElement, any, any, any>, tag: string, className: string) {
  const node = root.selectAll(`${tag}.${className}`);

  node
    .data([tag])
    .enter()
    .append<GElement>(tag)
    .attr("class", className);

  return root.select<GElement>(`${tag}.${className}`);
}

export function getScaleLinear(
  x0: number,
  x1: number,
  data?: Iterable<number>,
  extent?: [number, number]
): d3.ScaleLinear<number, number> {

  let _extent = extent
  if (_extent === undefined) {
    if (data != undefined) {
      _extent = (d3.extent(data) as [number, number]);
    }
    else {
      throw "Column data and extent should not be both invalid."
    }
  }
  return d3
    .scaleLinear()
    .domain(_extent)
    // .nice()
    .range([x0, x1]);

}

export function calIntervalsCommon(
    startDate: Date,
    endDate: Date,
): number{
      let size=9
      const ONE_HOUR = 60
      const ONE_MIN = 1
      const definedIntervalMins = [15*ONE_MIN, 30*ONE_MIN, ONE_HOUR, 2*ONE_HOUR, 4*ONE_HOUR, 6*ONE_HOUR, 12*ONE_HOUR, 24*ONE_HOUR]
      let mins =  Math.round((endDate.valueOf() - startDate.valueOf())/1000/60)
      let choseInterval = 0
      for(let i=0; i<definedIntervalMins.length; i++){
          for(size = 9; size<=14; size++){
             if(choseInterval)
                  break
              if(definedIntervalMins[i]*size>=mins){
                  choseInterval = definedIntervalMins[i]
                  break
              }
          }
          if(choseInterval)
                  break
      }
      if(choseInterval==0){ 
            let days= Math.ceil(mins/60/24)
            let minRemain = -1
            let minSize = 0
            for(size = 9; size<=12; size++){
                if(days % size > minRemain && minRemain){
                    minRemain = days%size
                    minSize = size
                }
                if(days % size == 0){
                    minRemain = days%size
                    minSize = size
                }
            }
            choseInterval = Math.floor(days/minSize) * 24*60
            if(choseInterval/60/24 > 15){
              choseInterval = Math.ceil(days/30/9)*30*24*60
            }
        }
        return choseInterval

}

export function getScaleTime(
  x0: number,
  x1: number,
  data?: Iterable<Date>,
  extent?: [Date, Date]
): d3.ScaleTime<number, number> {
  let _extent = extent
  if (_extent === undefined) {
    if (data != undefined) {
      _extent = (d3.extent(data) as [Date, Date]);
    }
    else {
      throw "Column data and extent should not be both invalid."
    }
  }
  return d3
    .scaleTime()
    .domain(_extent)
    // .nice()
    .range([x0, x1])
    // .ticks(d3.timeHour.every(size!/60));
}

export function countCategories(data: ArrayLike<string | number>, categories?: string[]) {
  const counter = _.countBy(data);
  const domain: string[] = categories || _.keys(counter).sort();
  return domain.map(
    (c, i) => ({
      count: counter[c] || 0,
      name: domain[i]
    })
  );
}

function getOuterPadding(
  width: number,
  nBars: number,
  innerPadding: number,
  maxStep: number
) {
  const minOuterPadding = Math.round(
    (width - maxStep * nBars + maxStep * innerPadding) / 2 / maxStep
  );
  let outerPadding = Math.max(minOuterPadding, innerPadding);
  return outerPadding;
}

export function getScaleBand(
  x0: number,
  x1: number,
  data?: ArrayLike<string>,
  categories?: Readonly<string[]>,
  innerPadding: number = 0.25,
  maxStep = 35
): d3.ScaleBand<string> {
  let domain = categories;
  if (domain === undefined) {
    if (data != undefined) {
      domain = countCategories(data).map(d => d.name);
    }
    else {
      throw "Column data and extent should not be both invalid."
    }
  }
  const outerPadding = getOuterPadding(
    x1 - x0,
    domain.length,
    innerPadding,
    maxStep
  );

  return d3
    .scaleBand()
    .domain(domain)
    .paddingInner(innerPadding)
    .paddingOuter(outerPadding)
    .rangeRound([x0, x1]);
}

export const DELAY_PAINT_TIME = 100;

export function isStringArray(x: number[] | string[]): x is string[] {
  return typeof x[0] === 'string';
}

export function beautifulPrinter(value: any, maxChar: number = 15): any {
  if (typeof (value) === typeof ("")) {
    return value.length > maxChar ? value.substring(0, 12) + "..." : value
  }
  if (typeof (value) === typeof (0.0)) {
    return _.round(value, 3)
  }
  if (typeof (value) === typeof ([]) && value.length > 0) {
    return `${beautifulPrinter(value[0], maxChar - 4)},...`
  }
  return value
}

export function getOffsetById(id: string) {
  var e: HTMLElement | null = document.getElementById(id);
  if (e) {
    const rect = e.getBoundingClientRect(),
      scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (rect)
      return {
        left: rect.left + scrollLeft,
        right: rect.right + scrollLeft,
        top: rect.top + scrollTop,
        bottom: rect.bottom + scrollTop
      }
  }
}