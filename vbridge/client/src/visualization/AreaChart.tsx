import * as d3 from "d3";
import * as _ from "lodash";
import {
    getMargin,
    ChartOptions,
    getChildOrAppend,
    defaultCategoricalColor,
} from "./common";
import HistogramLayout, { BinLayout, HistogramLayoutStyle } from './HistogramLayout';
import { defaultOptions, drawSublines } from "./Histogram";
import Chart, { ChartProps } from "./Chart";
import "./AreaChart.scss";

export type IAreaChartOptions = Partial<HistogramLayoutStyle> & ChartOptions & {
    drawLeftAxis?: boolean,
    drawBottomAxis?: boolean,
    color?: (x: number) => string,
}

export function drawAreaChart(param: {
    root: SVGElement | SVGGElement,
    data: number[] | number[][],
    options?: Partial<IAreaChartOptions>
}
) {
    const { data, options } = param;
    const opts = { ...defaultOptions, ...options };
    const { drawLeftAxis, drawBottomAxis, ...rest } = opts;
    const margin = getMargin(opts.margin);
    const width = opts.width - margin.left - margin.right;
    const height = opts.height - margin.top - margin.bottom;
    const color = opts.color || defaultCategoricalColor;

    const layout = new HistogramLayout({
        ...rest,
        data: data,
        width: width,
        height: height,
    });

    const bins = layout.layout;
    const yRange = layout.yRange;
    const xScale = layout.x;

    const root = d3.select(param.root);

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const area = d3.area<BinLayout>()
        .x(d => xScale((d.x0! + d.x1!) / 2))
        .y0(d => d.y)
        .y1(d => d.y + d.height)
        .curve(d3.curveMonotoneX);
    base.selectAll<SVGGElement, BinLayout[]>("path.area")
        .data(bins)
        .join(
            enter => enter.append("path")
                .attr("class", "area"),
            update => update,
            exit => exit.remove()
        )
        .attr("fill", (d, i) => color(i))
        .attr("d", d => area(d));

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .style("display", drawLeftAxis ? 'block' : 'none')
        .call(d3.axisLeft(layout.y).ticks(4));

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${yRange[0]})`)
        .attr("display", drawBottomAxis ? 'block' : 'none')
        .call(d3.axisBottom(xScale).ticks(5));
}

export type IAreaChartProps = IAreaChartOptions & ChartProps & {
    data: number[] | number[][];
    referenceValue?: number,
    whatIfValue?: number,
}

export default class AreaChart extends Chart<IAreaChartProps> {
    constructor(props: IAreaChartProps) {
        super(props);
    }

    protected paint() {
        const root = this.svgRef.current;
        const { data, className, style, svgStyle, referenceValue,
            whatIfValue, ...rest } = this.props;
        if (root) {
            drawAreaChart({
                root, data, options: rest
            });
            drawSublines({
                root, data, referenceValue, whatIfValue, options: rest
            });
            this.shouldPaint = false;
        }
    }

    public render() {
        const { style, svgStyle, className, width, height } = this.props;
        return (
            <div className={(className || "") + " area-chart"} style={style}>
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