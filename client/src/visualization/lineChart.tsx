import * as d3 from "d3"
import * as React from "react"
import * as _ from 'lodash'
import "./lineChart.css"

import { getChildOrAppend, getScaleLinear, getScaleTime, defaultCategoricalColor, IMargin, getMargin } from "./common";
import { ISeries } from "data-forge";
import { ReferenceValue } from "data/common";
import { ImportsNotUsedAsValues } from "typescript";
import { Segment } from "data/event";

export type PointLayout = {
    x: number,
    y: number,
    value: number,
    date: Date,
    index: number,
}

export interface LineChartOptions {
    width: number,
    height: number,
    margin?: IMargin,
    xScale?: d3.ScaleTime<number, number>,
    yScale?: d3.ScaleLinear<number, number>,
    color?: string,
    expand?: boolean,

    drawXAxis?: boolean,
    drawYAxis?: boolean,
    drawDots?: boolean,
    drawAnnotations?: boolean,
    drawReferences?: boolean,
}

export interface LineChartParams extends LineChartOptions {
    data: { dates: ISeries<number, Date>, values: ISeries<number, any> }
    referenceValue?: ReferenceValue,
    segments?: Segment[],
    svg: SVGElement,
}

export function drawLineChart(params: LineChartParams) {
    const { data, svg, referenceValue, segments, xScale, yScale, drawXAxis, drawYAxis,
        drawDots, drawReferences, drawAnnotations } = params;
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
    if (referenceValue && referenceValue.ci95 && params.expand) {
        maxValue = Math.max(maxValue, referenceValue.ci95[1]);
        minValue = Math.min(minValue, referenceValue.ci95[0]);
    }
    const yPadding = (maxValue - minValue) * 0.1
    const y = yScale || getScaleLinear(0, height, undefined,
        [maxValue + yPadding, Math.max(minValue - yPadding, 0)]);

console.log(margin);

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(t))
        .attr("display", drawXAxis ? 'block' : 'none');
    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .call(d3.axisLeft(y).ticks(3))
        .attr("display", drawYAxis ? 'block' : 'none');

    const line = d3.line().curve(d3.curveMonotoneX);
    const points: PointLayout[] = dates.map((date, i) => {
        return {
            x: t(date),
            y: y(values[i]),
            value: values[i],
            date: date,
            index: i
        }
    })
        .filter(d => (d.x === d.x) && (d.y === d.y));
    const pointPairs: [PointLayout, PointLayout][] | undefined =
        points.length > 1 ? _.range(0, points.length - 1).map(i => [points[i], points[i + 1]]) : undefined

    const outofCI = referenceValue && referenceValue.ci95 && ((value: number) => value < referenceValue.ci95[0] || value > referenceValue.ci95[1]);
    const lower = referenceValue && referenceValue.ci95 && ((value: number) => value < referenceValue.ci95[0]);
    const higher = referenceValue && referenceValue.ci95 && ((value: number) => value > referenceValue.ci95[1]);

    // let higherSegments: PointLayout[][] = [];
    // let lowerSegments: PointLayout[][] = [];
    let outofCISegments: { type: 'high' | 'low', points: PointLayout[] }[] = []
    if (lower && higher) {
        let currentHigherBin: PointLayout[] = [];
        let currentLowerBin: PointLayout[] = [];
        for (const point of points) {
            if (lower(point.value)) {
                currentLowerBin.push(point);
            }
            else {
                if (currentLowerBin.length > 0) {
                    outofCISegments.push({ type: 'low', points: currentLowerBin })
                    currentLowerBin = [];
                }
            }
            if (higher(point.value)) {
                currentHigherBin.push(point);
            }
            else {
                if (currentHigherBin.length > 0) {
                    outofCISegments.push({ type: 'high', points: currentHigherBin })
                    currentHigherBin = [];
                }
            }
        }
        if (currentLowerBin.length > 0) {
            outofCISegments.push({ type: 'low', points: currentLowerBin })
            currentLowerBin = [];
        }
        if (currentHigherBin.length > 0) {
            outofCISegments.push({ type: 'high', points: currentHigherBin })
            currentHigherBin = [];
        }
    }
    // getChildOrAppend(base, 'path', 'line')
    //     .datum(points)
    //     .attr("class", "line")
    //     .attr("d", line);
    // const segmentLayouts: SegmentLayout[] | undefined = segments?.map(d => {
    //     const involvedValues = 
    //     return {...d}
    // })



    pointPairs && getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "line-base")
        .selectAll(".line-seg")
        .data(pointPairs)
        .join(
            enter => enter.append("line")
                .attr("class", 'line-seg'),
            update => update,
            exit => exit.remove()
        )
        .attr("x1", d => d[0].x)
        .attr("y1", d => d[0].y)
        .attr("x2", d => d[1].x)
        .attr("y2", d => d[1].y)
        // .attr('stroke-width', (d, i) => outofCI && (outofCI(values[i]) && outofCI(values[i+1])) ?  '1px' : '0px')
        .classed("highlight", (d, i) => outofCI ? (outofCI(values[i]) && outofCI(values[i + 1])) : false)
        .classed("dashed", (d, i) => outofCI && !params.expand ? !(outofCI(values[i]) && outofCI(values[i + 1])) : false)

    const annotBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "point-anno-base")
    // annotBase.selectAll(".point-anno-arrow")
    //     .data(points)
    //     .join(
    //         enter => enter
    //             .append("line")
    //             .attr("class", "point-anno-arrow"),
    //         update => update,
    //         exit => { exit.remove() }
    //     )
    //     .attr("display", (d, i) => (outofCI && outofCI(values[i])) ? "block" : "none")
    //     .attr("x1", d => d.x)
    //     .attr("x2", d => d.x)
    //     .attr("y1", d => d.y)
    //     .attr("y2", (d, i) => {
    //         if (lower && lower(values[i])) {
    //             return d.y + 5;
    //         }
    //         if (higher && higher(values[i])) {
    //             return d.y - 5;
    //         }
    //         return d.y;
    //     })
    //     .style("marker-end", "url(#arrowhead)");

    const abnormalBase = getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "point-anno-base");
    abnormalBase
        .selectAll(".point-anno-arrow")
        .data(outofCISegments)
        .join(
            enter => enter
                .append("line")
                .attr("class", "point-anno-arrow"),
            update => update,
            exit => { exit.remove() }
        )
        .attr('display', drawAnnotations ? 'block' : 'none')
        .attr("x1", d => (d.points[0].x + d.points[d.points.length - 1].x) / 2)
        .attr("x2", d => (d.points[0].x + d.points[d.points.length - 1].x) / 2)
        .attr("y1", d => d.points[0].y)
        .attr("y2", (d, i) => d.points[0].y + (d.type === 'high' ? -5 : 5))
        .style("marker-end", "url(#arrowhead)");

    const beginEndOfSeg = (point: PointLayout): 'begin' | 'end' | 'none' => {
        for (const seg of outofCISegments) {
            const { points } = seg;
            if (point.index === points[0].index) return 'begin';
            if (point.index === points[points.length - 1].index) return 'end';
        }
        return 'none'
    }


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
        // .attr("display", (d, i) => drawDots || (outofCI && outofCI(values[i])) ? "block" : "none")
        .attr("display", d => beginEndOfSeg(d) === 'none' ? 'none' : 'block')
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 3)
        // .classed("highlight", (d, i) => outofCI ? outofCI(values[i]) : false);
        .classed("highlight", d => beginEndOfSeg(d) === 'none' ? false : true)

    const padding = 5;

    if (segments) {
        getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "segment-base")
            .selectAll(".segment-box")
            .data(segments)
            .join(
                enter => enter
                    .append("rect")
                    .attr("class", "segment-box"),
                update => update,
                exit => { exit.remove() }
            )
            .attr("x", d => t(new Date(d.startTime)) - padding)
            .attr("width", d => t(new Date(d.endTime)) - t(new Date(d.startTime)) + 2 * padding)
            .attr("y", d => y(d.maxValue) - 5)
            .attr("height", d => y(d.minValue) - y(d.maxValue) + 10)
            .attr("rx", 2);
            // .attr("y", 0)
            // .attr("height", height);
    }


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
    segments?: Segment[]
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
            <svg ref={this.ref} className={"ts-svg"} style={{ width: width, height: height }}>
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" viewBox="0 0 20 20"
                        refX="0" refY="5" orient="auto">
                        <polygon points="0 0, 10 5, 0 10" fill="#e13c60" />
                    </marker>
                    {/* <marker id="arrowhead" viewBox="64 64 896 896"
                        orient="auto">
                        <path d = "M868 545.5L536.1 163a31.96 31.96 0 00-48.3 0L156 545.5a7.97 7.97 0 006 13.2h81c4.6 0 9-2 12.1-5.5L474 300.9V864c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V300.9l218.9 252.3c3 3.5 7.4 5.5 12.1 5.5h81c6.8 0 10.5-8 6-13.2z"/>
                    </marker> */}
                </defs>
            </svg>
        </div>
    }
}