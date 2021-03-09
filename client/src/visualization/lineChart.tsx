import * as d3 from "d3"
import * as React from "react"
import "./lineChart.css"

import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { ISeries } from "data-forge";
import { referenceValue } from "data/common";

export interface LineChartOptions {
    width: number,
    height: number,
    margin?: IMargin,
    xScale?: d3.ScaleTime<number, number>,
    yScale?: d3.ScaleLinear<number, number>,
    color?: string,

    drawXAxis?: boolean,
    drawYAxis?: boolean,
    drawDots?: boolean,
    drawReferences?: boolean,
}

export interface LineChartParams extends LineChartOptions {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
    referenceValue?: referenceValue
    svg: SVGElement,
}

export function drawLineChart(params: LineChartParams) {
    const { data, svg, referenceValue, xScale, yScale, drawXAxis, drawYAxis, drawReferences } = params;
    const dates = data.dates.toArray();
    const values = data.values.toArray();
    const root = d3.select(svg);
    const margin = getMargin(params.margin || {});
    const height = params.height - margin.top - margin.bottom;
    const width = params.width - margin.left - margin.right;

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const t = xScale || getScaleTime(0, width, data.dates);

    let maxValue = d3.max(values);
    let minValue = d3.min(values);
    if (referenceValue) {
        maxValue = Math.max(maxValue, referenceValue.ci95[1]);
        minValue = Math.min(minValue, referenceValue.ci95[0]);
    }
    const y = yScale || getScaleLinear(0, height, undefined, [maxValue, minValue]);

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(t))
        .attr("display", drawXAxis ? 'block' : 'none');
    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .call(d3.axisLeft(y).ticks(3))
        .attr("display", drawYAxis ? 'block' : 'none');

    const line = d3.line().curve(d3.curveMonotoneX);
    const points: [number, number][] = dates.map((date, i) => [t(date), y(values[i])] as [number, number])
        .filter(d => (d[0] === d[0]) && (d[1] === d[1]));

    const outofCI = referenceValue && ((value: number) => value < referenceValue.ci95[0] || value > referenceValue.ci95[1]);

    getChildOrAppend(base, 'path', 'line')
        .datum(points)
        .attr("class", "line")
        .attr("d", line);

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "point-base")
        .selectAll(".point")
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
        .attr("r", 3)
        .style("fill", (d, i) => (outofCI && outofCI(values[i])) ? 'red' : '#aaa');

    if (referenceValue) {
        getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", y(referenceValue.mean))
            .attr("y2", y(referenceValue.mean))
            .attr("display", drawReferences ? 'block' : 'none');
        getChildOrAppend<SVGRectElement, SVGGElement>(base, "rect", "reference-area")
            .attr("width", width)
            .attr("height", y(referenceValue.ci95[0]) - y(referenceValue.ci95[1]))
            .attr("transform", `translate(0, ${y(referenceValue.ci95[1])})`)
            .attr("display", drawReferences ? 'block' : 'none');
    }
}

export interface LineChartProps extends LineChartOptions {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
    referenceValue?: referenceValue
}

export default class LineChart extends React.PureComponent<LineChartProps> {
    private ref: React.RefObject<SVGSVGElement> = React.createRef();
    constructor(props: LineChartProps) {
        super(props);
    }

    componentDidMount() {
        this.paint();
    }

    componentDidUpdate(prevProps: LineChartProps) {
        if (prevProps !== this.props) {
            this.paint();
        }
    }

    paint() {
        const { ...rest } = this.props;
        const node = this.ref.current;
        if (node) {
            drawLineChart({
                svg: node,
                ...rest
            })
        }
    }

    render() {
        const { height, width } = this.props;
        return <div>
            <svg ref={this.ref} className={"ts-svg"} style={{ width: width, height: height }} />
        </div>
    }
}