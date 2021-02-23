import * as d3 from "d3"
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import "./timeline.css"

export type Events = {
    timestamp: Date,
    count: number,
}

export function drawTimeline(params: {
    events: Events[],
    svg: SVGElement,

    width: number,
    height: number,
    margin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: string,
}) {
    const { color, events, svg, timeScale } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const axisBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "axis-base")
        .attr("transform", `translate(0, ${height / 2})`);
    const bubbleBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "bubble-base")
        .attr("transform", `translate(0, ${height / 2})`);

    const axis = getChildOrAppend<SVGLineElement, SVGGElement>(axisBase, "line", "axis-line")
        .attr("class", "axis-line")
        .attr("x2", width);

    const t = timeScale || getScaleTime(0, width, events.map(e => e.timestamp));
    const r = getScaleLinear(0, 10, events.map(d => d.count));

    const bubbles = bubbleBase.selectAll(".bubble")
        .data(events)
        .join<SVGCircleElement>(enter => {
            return enter
                .append("circle")
                .attr("class", "bubble");
        })
        .attr("cx", d => t(d.timestamp))
        .attr("r", d => r(d.count))
        .style("fill", color || defaultCategoricalColor(0));

}

export function drawTimelineAxis(params: {
    svg: SVGElement,
    timeScale: d3.ScaleTime<number, number>,

    width: number,
    height: number,
    margin?: IMargin,
    color?: string,
}) {
    const { svg, timeScale } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.right})`);
    const taxis = d3.axisBottom(timeScale);
    base.call(taxis);
}