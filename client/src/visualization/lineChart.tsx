import * as d3 from "d3"
import * as React from "react"
import * as _ from 'lodash'
import "./lineChart.css"

import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { ISeries } from "data-forge";
import { ReferenceValue } from "data/common";

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
    referenceValue?: ReferenceValue
    svg: SVGElement,
}

export function drawLineChart(params: LineChartParams) {
    const { data, svg, referenceValue, xScale, yScale, drawXAxis, drawYAxis,
        drawDots, drawReferences } = params;
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
    if (referenceValue && referenceValue.ci95) {
        maxValue = Math.max(maxValue, referenceValue.ci95[1]);
        minValue = Math.min(minValue, referenceValue.ci95[0]);
    }
    // padding
    const y = yScale || getScaleLinear(0, height, undefined, 
        [maxValue+(maxValue-minValue)*0.1, Math.max(minValue-(maxValue-minValue)*0.1, 0)]);

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
    const pointPairs: [[number, number], [number, number]][] | undefined =
        points.length > 1 ? _.range(0, points.length - 1).map(i => [points[i], points[i+1]]) : undefined

    const outofCI = referenceValue && referenceValue.ci95 && ((value: number) => value < referenceValue.ci95[0] || value > referenceValue.ci95[1]);

    // getChildOrAppend(base, 'path', 'line')
    //     .datum(points)
    //     .attr("class", "line")
    //     .attr("d", line);
    pointPairs && getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "line-base")
        .selectAll(".line-seg")
        .data(pointPairs)
        .join(
            enter => enter.append("line")
                .attr("class", 'line-seg'),
            update => update,
            exit => exit.remove()
        )
        .attr("x1", d => d[0][0])
        .attr("y1", d => d[0][1])
        .attr("x2", d => d[1][0])
        .attr("y2", d => d[1][1])
        .classed("highlight", (d, i) => outofCI ? (outofCI(values[i]) && outofCI(values[i+1])) : false);

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
        .attr("display", (d, i) => drawDots || (outofCI && outofCI(values[i])) ? "block" : "none")
        .attr("cx", d => d[0])
        .attr("cy", d => d[1])
        .attr("r", 3)
        .classed("highlight", (d, i) => outofCI ? outofCI(values[i]) : false);

    if (referenceValue) {
        getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", y(referenceValue.mean))
            .attr("y2", y(referenceValue.mean))
            .attr("display", drawReferences ? 'block' : 'none');
        if (referenceValue.ci95)
            getChildOrAppend<SVGRectElement, SVGGElement>(base, "rect", "reference-area")
                .attr("width", width)
                .attr("height", y(Math.max(0, referenceValue.ci95[0])) - y(referenceValue.ci95[1]))
                .attr("transform", `translate(0, ${y(referenceValue.ci95[1])})`)
                .attr("display", drawReferences ? 'block' : 'none');
    }
}

export interface LineChartProps extends LineChartOptions {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
    referenceValue?: ReferenceValue
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