import * as d3 from "d3"
import { useState } from "react";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import "./timeline.css"

export type Event = {
    timestamp: Date,
    count: number,
}

export function drawTimeline(params: {
    events: Event[],
    svg: SVGElement,

    width: number,
    height: number,
    margin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: string,
    onBrush?: (startDate: Date, endDate: Date) => void
}) {
    const { color, events, svg, timeScale, onBrush } = params
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

    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed)
        .on("end", brushend);

    base.call(brush)
        .on("click", brushed)

    function brushed(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            const extent = selection.map(t.invert);
        }
    }

    function brushend(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            const extent = selection.map(t.invert);
            onBrush && onBrush(extent[0], extent[1]);
        }
    }

    const bubbles = bubbleBase.selectAll(".bubble")
        .data(events)
        .join<SVGCircleElement>(enter => {
            return enter
                .append("circle")
                .attr("class", "bubble");

        }, update => update,
            exit => { exit.remove() })
        .attr("cx", d => t(d.timestamp))
        .attr("r", d => r(d.count))
        .style("fill", color || defaultCategoricalColor(0));

}

export function drawTimelineAxis(params: {
    svg: SVGElement,
    defaultTimeScale: d3.ScaleTime<number, number>,

    width: number,
    height: number,
    margin?: IMargin,
    color?: string,
    updateTimeScale?: (scale: d3.ScaleTime<number, number>) => void
}) {
    const { svg, defaultTimeScale, updateTimeScale } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const focusedTimeScale = d3.scaleTime().range([0, width]).domain(defaultTimeScale.domain());

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const defaultAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "long-axis-base")
        .attr("transform", `translate(0, ${height})`);
    const focusedAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "short-axis-base")
    const band = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "brush-base");

    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush", brushed);

    band.call(brush)
        .on("click", brushed)

    function brushed(event: { selection: [number, number] }) {
        const { selection } = event;
        if (selection) {
            const extent = selection.map(defaultTimeScale.invert);
            focusedTimeScale.domain(extent);
            updateAxis();
        }
        else {
            const extent = defaultTimeScale.domain();
            focusedTimeScale.domain(extent);
            updateAxis();
        }
    }

    const longAxis = d3.axisBottom(defaultTimeScale);
    defaultAxisbase.call(longAxis);

    function updateAxis() {
        focusedAxisbase.call(shortAxis);
        updateTimeScale && updateTimeScale(focusedTimeScale);
    }

    const shortAxis = d3.axisBottom(focusedTimeScale);
    focusedAxisbase.call(shortAxis);
}