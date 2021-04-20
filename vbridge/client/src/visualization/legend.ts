import { colors } from "@material-ui/core";
import * as d3 from "d3"
// import { IEventBin, MetaEvent } from "data/event";
// import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
// import "./timeline.css"

export function drawLegend(params: {
    node: SVGElement | SVGGElement,
    width: number,
    height: number,
}){
    const { node, height, width} = params
    // console.log('drawTimeline', params)
    const root = d3.select(node);


    // const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
    //     .attr("transform", `translate(${margin.left}, ${margin.top})`);
    // const axisBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "axis-base")
    //     .attr("transform", `translate(0, ${height})`);
    // const bubbleBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "bubble-base")


    // const axis = getChildOrAppend<SVGLineElement, SVGGElement>(axisBase, "line", "axis-line")
    //     .attr("class", "axis-line")
    //     .attr("x2", width);

    // const t = timeScale || getScaleTime(0, width, [...events.map(e => e.binStartTime), ...events.map(e => e.binEndTime)]);
    // // const r = getScaleLinear(0, 30, events.map(d => d.count));
    // const colorScale = getScaleLinear(0.2, 0.5, undefined, [0, d3.max(events.map(d => d.count))!]);
    // // const color = (id: number) => d3.interpolateRgb('#B2FEFA', '#0ED2F7')(colorScale(id));
    // const color = (id: number) => d3.interpolateBlues(colorScale(id));
}