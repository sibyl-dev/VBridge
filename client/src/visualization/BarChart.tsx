import * as d3 from "d3";
import * as _ from "lodash";
import {
    getMargin,
    getChildOrAppend,
    ChartOptions,
    CSSPropertiesFn,
} from "./common";
import { defaultCategoricalColor } from "./color";
import BarChartLayout, { BinLayout, BarChartLayoutStyle } from './BarChartLayout'
import Chart, { ChartProps } from "./Chart";
import "./BarChart.scss";

export type IBarChartOptions = Partial<BarChartLayoutStyle> & ChartOptions & {
    drawLeftAxis?: boolean,
    drawBottomAxis?: boolean,
    rectStyle?: CSSPropertiesFn<SVGRectElement, d3.Bin<number, number>>,
    color?: (x: number) => string,
}

export const defaultOptions = {
    width: 300,
    height: 200,
    margin: 0,
    innerPadding: 1,
    drawAxis: false,
    drawBottomAxis: true,
};

export function drawBarChart(param: {
    root: SVGElement | SVGGElement,
    data: string[] | string[][],
    options?: Partial<IBarChartOptions>
}
) {
    const { data, options } = param;
    const opts = { ...defaultOptions, ...options };
    const { rectStyle, drawLeftAxis, drawBottomAxis, ...rest } = opts;
    const margin = getMargin(opts.margin);
    const width = opts.width - margin.left - margin.right;
    const height = opts.height - margin.top - margin.bottom;
    const color = opts.color || defaultCategoricalColor;

    const layout = new BarChartLayout({
        ...rest,
        data: data,
        width: width,
        height: height,
    });

    const root = d3.select(param.root);
    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const barGroups = base.selectAll<SVGGElement, BinLayout<string>[]>("g.groups")
        .data(layout.layout)
        .join<SVGGElement>(
            enter => enter.append("g")
                .attr("class", "groups"),
            update => update,
            exit => exit.remove()
        )
        .attr("fill", (d, i) => color(i));
    const bars = barGroups.selectAll("rect.bar")
        .data(d => d)
        .join<SVGRectElement>(
            enter => enter.append("rect")
                .attr("class", "bar"),
            update => update,
            exit => exit.remove()
        )
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .attr("width", d => d.width)
        .attr("height", d => d.height)

    if (rectStyle) {
        Object.keys(rectStyle).forEach(key => {
            bars.style(
                key,
                (rectStyle[key as keyof typeof rectStyle] || null) as null
            );
        });
    }

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .style("display", drawLeftAxis ? 'block' : 'none')
        .call(d3.axisLeft(layout.y).ticks(4));

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${layout.yRange[0]})`)
        .attr("display", drawBottomAxis ? 'block' : 'none')
        .call(d3.axisBottom(layout.x).ticks(5));
}

// export function drawSublines(param: {
//     root: SVGElement | SVGGElement,
//     data: string[] | number[][],
//     referenceValue?: number,
//     whatIfValue?: number,
//     options?: Partial<IBarChartOptions>
// }
// ) {
//     const { data, options, referenceValue, whatIfValue } = param;
//     const opts = { ...defaultOptions, ...options };
//     const margin = getMargin(opts.margin);
//     const width = opts.width - margin.left - margin.right;
//     const height = opts.height - margin.top - margin.bottom;

//     const layout = new BarChartLayout({
//         ...opts,
//         data: data,
//         width: width,
//         height: height,
//     });

//     const root = d3.select(param.root);
//     const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
//         .attr("transform", `translate(${margin.left}, ${margin.top})`);

//     getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
//         .attr("x1", layout.x(referenceValue || 0))
//         .attr("x2", layout.x(referenceValue || 0))
//         .attr("y1", layout.yRange[0])
//         .attr("y2", layout.yRange[1])
//         .style("display", (referenceValue !== undefined) ? 'block' : 'none')

//     getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line-whatif")
//         .attr("x1", layout.x(whatIfValue || 0))
//         .attr("x2", layout.x(whatIfValue || 0))
//         .attr("y1", layout.yRange[0])
//         .attr("y2", layout.yRange[1])
//         .style("display", (whatIfValue !== undefined) ? 'block' : 'none')
// }

export type IBarChartProps = IBarChartOptions & ChartProps & {
    data: string[] | string[][];
    referenceValue?: number,
    whatIfValue?: number,
}

export default class BarChart extends Chart<IBarChartProps> {
    constructor(props: IBarChartProps) {
        super(props);
    }

    protected paint() {
        const root = this.svgRef.current;
        const { data, className, style, svgStyle, referenceValue,
            whatIfValue, ...rest } = this.props;
        if (root) {
            drawBarChart({ root, data, options: rest });
            // drawSublines({ root, data, referenceValue, whatIfValue, options: rest });
            this.shouldPaint = false;
        }
    }

    public render() {
        const { style, svgStyle, className, width, height } = this.props;
        return (
            <div className={(className || "") + " bar-chart"} style={style}>
                <svg
                    ref={this.svgRef}
                    style={svgStyle}
                    width={width}
                    height={height}
                />
            </div>
        );
    }
}