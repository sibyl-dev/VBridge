import * as d3 from "d3"
import { IEvent } from "data/event";
import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { drawStackedAreaChart } from "./stackedAreaChart";

export function drawTimelineAxis(params: {
    svg: SVGElement,
    defaultTimeScale: d3.ScaleTime<number, number>,

    width: number,
    height: number,
    margin?: IMargin,
    color?: (id: number) => string,
    updateTimeScale?: (scale: d3.ScaleTime<number, number>) => void,

    drawAreaChart?: boolean,
    events?: IEvent[][],
}) {
    const { svg, defaultTimeScale, updateTimeScale, drawAreaChart, events, color } = params
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const focusedTimeScale = d3.scaleTime().range([0, width]).domain(defaultTimeScale.domain());

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    const focusedAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "short-axis-base");
    const areaChartbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "area-chart-base")
        .attr("transform", `translate(0, 20)`);
    const defaultAxisbase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "long-axis-base")
        .attr("transform", `translate(0, ${height})`);
    const band = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "brush-base")
        .attr("transform", `translate(0, ${height})`);

    const brush = d3.brushX()
        .extent([[0, -10], [width, 10]])
        .on("brush", brushed);

    band.call(brush)
        .on("click", brushed);

    function brushed(event: { selection: [number, number] }) {
        const { selection } = event;
        let extent = []
        if (selection) {
            extent = selection.map(defaultTimeScale.invert);
        }
        else {
            extent = defaultTimeScale.domain();
        }
        focusedTimeScale.domain(extent).nice();
        updateAxis();
    }

    const longAxis = d3.axisBottom(defaultTimeScale);
    defaultAxisbase.call(longAxis);

    function updateAxis() {
        focusedAxisbase.call(shortAxis);
        updateTimeScale && updateTimeScale(focusedTimeScale);
    }

    const shortAxis = d3.axisBottom(focusedTimeScale);
    focusedAxisbase.call(shortAxis);

    const areaChartNode = areaChartbase.node();
    if (drawAreaChart && areaChartNode && events) {
        drawStackedAreaChart({
            node: areaChartNode,
            timeScale: defaultTimeScale,
            width: width,
            height: height - 20,
            margin: {top: 0, bottom: 0, left: 0, right: 0},
            color: color,
            events: events
        })
    }
}