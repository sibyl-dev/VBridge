import * as d3 from "d3"
import "./lineChart.css"

import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { ISeries } from "data-forge";

export function drawLineChart(params: {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
    svg: SVGElement,

    width: number,
    height: number,
    margin?: IMargin,
    timeScale?: d3.ScaleTime<number, number>,
    color?: string,

    drawXAxis?: boolean,
    drawYAxis?: boolean,
    drawDots?: boolean,
}) {
    const { color, data, svg, timeScale } = params
    const dates = data.dates.toArray();
    const values = data.values.toArray();
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const t = timeScale || getScaleTime(0, width, data.dates);

    const maxValue = d3.max(values);
    const minValue = Math.max(0, d3.min(values))
    const y = getScaleLinear(0, height, undefined, [maxValue, minValue]);

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(t));
    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .call(d3.axisLeft(y).ticks(5));

    const line = d3.line().curve(d3.curveMonotoneX);
    const points: [number, number][] = dates.map((date, i) => [t(date), height - y(values[i])] as [number, number])
        .filter(d => (d[0] === d[0]) && (d[1] === d[1]));

    base.selectAll(".point")
        .data(points)
        .join(
            enter => enter
                .append("circle")
                .attr("class", "point"),
            update => update,
            exit => { exit.remove() }
        )
        .attr("cx", d => d[0])
        .attr("cy", d => d[1])
        .attr("r", 3);

    getChildOrAppend(base, 'path', 'line')
        .datum(points)
        .attr("class", "line")
        .attr("d", line);
}