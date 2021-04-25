import * as d3 from "d3";
import * as _ from "lodash";
import * as React from "react";
import {
    getMargin,
    CSSPropertiesFn,
    ChartOptions,
    getChildOrAppend,
    defaultCategoricalColor,
} from "./common";
import { shallowCompare } from '../data/common';
import { BinLayout, HistogramLayoutStyle } from './HistogramLayout'
import HistogramLayout from "./HistogramLayout";
import "./Histogram.scss";

export type IHistogramOptions = Partial<HistogramLayoutStyle> & ChartOptions & {
    drawLeftAxis?: boolean,
    drawBottomAxis?: boolean,
    areaChart?: boolean,
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

export function drawGroupedHistogram(param: {
    root: SVGElement | SVGGElement,
    data: number[] | number[][],
    referenceValue?: number,
    whatIfValue?: number,
    options?: Partial<IHistogramOptions>
}
) {
    const { data, options, referenceValue, whatIfValue } = param;
    const opts = { ...defaultOptions, ...options };
    const { rectStyle, drawLeftAxis, drawBottomAxis, areaChart, 
        ...rest } = opts;
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
    const xRange = layout.xRange;
    const yRange = layout.yRange;
    const xScale = layout.x;

    const root = d3.select(param.root);

    const base = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "base")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    if (areaChart) {
        const area = d3.area<BinLayout>()
            .x(d => d.x)
            .y0(d => d.y)
            .y1(d => d.y + d.height)
            .curve(d3.curveMonotoneX);
        base.selectAll<SVGGElement, BinLayout[]>("path.area")
            .data(bins)
            .join(enter => {
                return enter
                    .append("path")
                    .attr("class", "area");
            })
            .attr("fill", (d, i) => color(i))
            .attr("d", d => area(d));
    }
    else {
        const barGroups = base.selectAll<SVGGElement, BinLayout[]>("g.groups")
            .data(bins)
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
    }


    getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
        .attr("x1", xScale(referenceValue || 0))
        .attr("x2", xScale(referenceValue || 0))
        .attr("y1", 0)
        .attr("y2", yRange[1])
        .style("display", (referenceValue !== undefined) ? 'block' : 'none')

    getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line-whatif")
        .attr("x1", xScale(whatIfValue || 0))
        .attr("x2", xScale(whatIfValue || 0))
        .attr("y1", 0)
        .attr("y2", yRange[1])
        .style("display", (whatIfValue !== undefined) ? 'block' : 'none')

    const yreverse = d3.scaleLinear().domain(layout.y.domain()).range([layout.y.range()[1], layout.y.range()[0]])

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "y-axis-base")
        .style("display", drawLeftAxis ? 'block' : 'none')
        .call(d3.axisLeft(yreverse).ticks(4));

    getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${yRange[1]})`)
        .attr("display", drawBottomAxis ? 'block' : 'none')
        .call(d3.axisBottom(xScale).ticks(5));
}

export type IHistogramProps = IHistogramOptions & {
    className?: string;

    data: number[] | number[][];
    referenceValue?: number,
    whatIfValue?: number,
    
    style?: React.CSSProperties;
    svgStyle?: React.CSSProperties;
}

export default class Histogram extends React.PureComponent<IHistogramProps> {
    private svgRef: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = false;

    constructor(props: IHistogramProps) {
        super(props);
        this.paint = this.paint.bind(this);
    }

    public paint() {
        const root = this.svgRef.current;
        if (root) {
            const { data, className, style, svgStyle, referenceValue, 
                whatIfValue, ...rest } = this.props;
            drawGroupedHistogram({
                root, data, referenceValue, whatIfValue,
                options: rest
            });
            this.shouldPaint = false;
        }
    }

    public componentDidMount() {
        this.paint();
    }

    public componentDidUpdate(
        prevProps: IHistogramProps,
    ) {
        const excludedProperties = new Set(["style", "svgStyle", "className"]);
        // const excludedState = new Set(["hoveredBin"]);
        if (!shallowCompare(this.props, prevProps, excludedProperties, true)) {
            this.shouldPaint = true;
            const delayedPaint = () => {
                if (this.shouldPaint) this.paint();
            };
            window.setTimeout(delayedPaint, 100);
        }
    }

    public render() {
        const { style, svgStyle, className, width, height } = this.props;
        return (
            <div className={(className || "") + " histogram"} style={style}>
                <svg
                    ref={this.svgRef}
                    style={{ ...svgStyle }}
                    width={width}
                    height={height}
                />
            </div>
        );
    }
}