import * as d3 from "d3";
import * as _ from "lodash";
import * as React from "react";
import {
    getMargin,
    CSSPropertiesFn,
    ChartOptions,
    getChildOrAppend,
    getScaleLinear,
    defaultCategoricalColor,
    isArrays
} from "./common";
import { shallowCompare } from '../data/common';
import { BarLayout } from './HistogramLayout'
import HistogramLayout from "./HistogramLayout";
import "./Histogram.scss";

export interface IHistogramOptions extends ChartOptions {
    innerPadding?: number;
    drawLeftAxis?: boolean,
    drawBottomAxis?: boolean,
    areaChart?: boolean,
    binColor?: (x: number) => string,
    rectStyle?: CSSPropertiesFn<SVGRectElement, d3.Bin<number, number>>;
    onRectMouseOver?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    // onRectMouseMove?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    onRectMouseLeave?: d3.ValueFn<any, d3.Bin<number, number>, void>;
    onSelectRange?: (range?: [number, number]) => any;
    xScale?: d3.ScaleLinear<number, number>;
    yScale?: d3.ScaleLinear<number, number>;
    ticks?: number[];
    selectedRange?: [number, number];
    nBinsMin?: number,
    nBinsMax?: number,
    barWidthMin?: number,
    barWidthMax?: number
}

export const defaultOptions = {
    width: 300,
    height: 200,
    margin: 0,
    innerPadding: 1,
    drawAxis: false,
    drawBottomAxis: true,
};

export type IHistogramProps = (IHistogramOptions | IGHistogramOptions) & {
    data: number[] | number[][];
    referenceValue?: number,
    whatIfValue?: number,
    style?: React.CSSProperties;
    svgStyle?: React.CSSProperties;
    className?: string;
    extent?: [number, number];
    drawRange?: boolean;
    mode?: 'side-by-side' | 'stacked';
    onHoverRange?: (range?: [number, number]) => any;
}

const defaultProps = {
    ...defaultOptions,
    drawLeftAxis: false,
    drawBottomAxis: true,
    drawRange: false
}

export interface IHistogramState {
    hoveredBin: [number, number] | null;
}

export default class Histogram extends React.PureComponent<
    IHistogramProps,
    IHistogramState
> {
    static defaultProps = { ...defaultProps };
    private svgRef: React.RefObject<SVGSVGElement> = React.createRef();
    private shouldPaint: boolean = false;

    constructor(props: IHistogramProps) {
        super(props);

        this.state = { hoveredBin: null };
        this.paint = this.paint.bind(this);
        this.onMouseOverBin = this.onMouseOverBin.bind(this);
        this.onMouseOverBins = this.onMouseOverBins.bind(this);
        this.onMouseLeaveBin = this.onMouseLeaveBin.bind(this);
        this.onMouseLeaveBins = this.onMouseLeaveBins.bind(this);

        this.onHoverRange = this.onHoverRange.bind(this);
    }

    public paint(svg: SVGSVGElement | null = this.svgRef.current) {
        if (svg) {
            console.debug("paint histogram");
            const { data, className, style, svgStyle, height, drawRange, referenceValue, whatIfValue, ...rest } = this.props;
            const xScale = rest.xScale || this.getXScale();
            const chartHeight = drawRange ? (height - 24) : (height - 4);
            drawGroupedHistogram({
                root: svg, data, referenceValue, whatIfValue,
                options: {
                    height: chartHeight,
                    ...rest,
                    xScale,
                    onRectMouseOver: this.onMouseOverBins,
                    onRectMouseLeave: this.onMouseLeaveBins,
                    onHoverRange: this.onHoverRange,
                    innerPadding: 0,
                }
            });

            this.shouldPaint = false;
        }
    }

    public componentDidMount() {
        this.paint();
    }

    public componentDidUpdate(
        prevProps: IHistogramProps,
        prevState: IHistogramState
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

    getXScale = () => {
        const { data, width } = this.props;
        const margin = getMargin(this.props.margin);
        return getScaleLinear(0, width - margin.left - margin.right, isArrays(data) ? _.flatten(data) : data);
    };

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

    onHoverRange(range: [number, number]) {
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(range);
        // this.setState({hoveredBin: range});
    }

    onMouseOverBin: d3.ValueFn<any, d3.Bin<number, number>, void> = (
        data,
        index,
        groups
    ) => {
        const { x0, x1 } = data;
        const hoveredBin: [number, number] = [
            x0 === undefined ? -Infinity : x0,
            x1 === undefined ? Infinity : x1
        ];
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(hoveredBin);
        this.setState({ hoveredBin });
    };

    onMouseOverBins: d3.ValueFn<any, d3.Bin<number, number>[], void> = (
        data,
        index
    ) => {
        const { x0, x1 } = data[0];
        const hoveredBin: [number, number] = [
            x0 === undefined ? -Infinity : x0,
            x1 === undefined ? Infinity : x1
        ];
        const { onHoverRange } = this.props;
        onHoverRange && onHoverRange(hoveredBin);
        this.setState({ hoveredBin });
    };

    onMouseLeaveBin: d3.ValueFn<any, d3.Bin<number, number>, void> = (
        data,
        index
    ) => {
        this.props.onHoverRange && this.props.onHoverRange();
        this.setState({ hoveredBin: null });
    };

    onMouseLeaveBins: d3.ValueFn<any, d3.Bin<number, number>[], void> = (
        data,
        index
    ) => {
        this.props.onHoverRange && this.props.onHoverRange();
        this.setState({ hoveredBin: null });
    };
}

export type IGHistogramOptions = Omit<IHistogramOptions, "onRectMouseOver" | "onRectMouseMove" | "onRectMouseLeave"> & {
    key: string,
    onRectMouseOver?: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    // onRectMouseMove: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    onRectMouseLeave?: d3.ValueFn<any, d3.Bin<number, number>[], void>;
    onHoverRange: (range: [number, number]) => void;
    color?: (x: number) => string;
    mode?: "side-by-side" | "stacked",
    rangeSelector?: "bin-wise" | "as-a-whole" | "none",
    direction?: "up" | "down",
}

export function drawGroupedHistogram(param: {
    root: SVGElement | SVGGElement,
    data: number[] | number[][],
    referenceValue?: number,
    whatIfValue?: number,
    options?: Partial<IGHistogramOptions>
}
) {
    const { data, options, referenceValue, whatIfValue } = param;
    const opts = { ...defaultOptions, ...options };
    const {
        rectStyle,
        onRectMouseOver,
        // onRectMouseMove,
        onRectMouseLeave,
        onSelectRange,
        onHoverRange,
        selectedRange,
        rangeSelector,
        drawLeftAxis,
        drawBottomAxis,
        areaChart,
        ...rest
    } = opts;
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
        const area = d3.area<BarLayout>()
            .x(d => d.x)
            .y0(d => d.y)
            .y1(d => d.y + d.height)
            .curve(d3.curveMonotoneX);
        const gs = base.selectAll<SVGGElement, BarLayout[]>("path.area")
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
        const gs = base.selectAll<SVGGElement, BarLayout[]>("g.groups")
            .data(bins)
            .join<SVGGElement>(enter => {
                return enter
                    .append("g")
                    .attr("class", "groups");
            })
            .attr("fill", (d, i) => color(i));
        const merged = gs
            .selectAll("rect.bar")
            .data(d => d)
            .join<SVGRectElement>(enter => {
                return enter
                    .append("rect")
                    .attr("class", "bar");
            })
            .attr("transform", (d, i) => `translate(${d.x}, ${d.y})`)
            .attr("width", d => d.width)
            .attr("height", d => d.height)

        if (rectStyle) {
            Object.keys(rectStyle).forEach(key => {
                merged.style(
                    key,
                    (rectStyle[key as keyof typeof rectStyle] || null) as null
                );
            });
        }
    }


    referenceValue && xScale && getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line")
        .attr("x1", xScale(referenceValue))
        .attr("x2", xScale(referenceValue))
        .attr("y1", 0)
        .attr("y2", yRange[1])

    xScale && getChildOrAppend<SVGLineElement, SVGGElement>(base, "line", "reference-line-whatif")
        .attr("x1", xScale(whatIfValue || 0))
        .attr("x2", xScale(whatIfValue || 0))
        .attr("y1", 0)
        .attr("y2", yRange[1])
        .style("display", (whatIfValue !== undefined) ? 'block' : 'none')

    const yreverse = d3.scaleLinear().domain(layout.y.domain()).range([layout.y.range()[1], layout.y.range()[0]])

    if (drawLeftAxis) {
        base.call(d3.axisLeft(yreverse).ticks(4));
    }

    xScale && getChildOrAppend<SVGGElement, SVGGElement>(base, "g", "x-axis-base")
        .attr("transform", `translate(0, ${yRange[1]})`)
        .attr("display", drawBottomAxis ? 'block' : 'none')
        .call(d3.axisBottom(xScale).ticks(5));

    // Render the shades for highlighting selected regions
    if (rangeSelector === 'bin-wise') {
        let rangeBrushing: [number, number] | null = null;
        if (selectedRange) {
            const startIndex = bins[0].findIndex(
                ({ x1 }) => x1 !== undefined && selectedRange[0] < x1
            );
            const endIndex = _.findLastIndex(
                bins[0],
                ({ x0 }) => x0 !== undefined && x0 < selectedRange[1]
            );
            rangeBrushing = [startIndex, endIndex];
        }
        // console.debug("brushed Range", rangeBrushing);
        let brushing: boolean = false;

        const gShades = getChildOrAppend<SVGGElement, SVGElement>(
            root,
            "g",
            "shades"
        ).attr(
            "transform",
            `translate(${margin.left}, ${margin.top})`
        )

        const renderShades = () => {
            return gShades
                .selectAll("rect.shade")
                .data(bins[0])
                .join<SVGRectElement>(enter => {
                    return enter
                        .append("rect")
                        .attr("class", "shade")
                        .attr("y", yRange[0]);
                })
                .attr("x", (d, i) => d.x)
                .attr("width", d => layout.x(d.x1 as number) - layout.x(d.x0 as number))
                .attr("height", yRange[1])
                .classed("show", (d, idx) =>
                    rangeBrushing
                        ? Math.min(...rangeBrushing) <= idx &&
                        idx <= Math.max(...rangeBrushing)
                        : false
                );
        };

        const merged2 = renderShades();
        merged2
            .on("mouseover", (event, d) => {
                // onRectMouseOver && onRectMouseOver(bins.map(bs => bs[idx]), idx, groups);
                if (brushing && rangeBrushing) {
                    const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                    rangeBrushing[1] = idx;
                    renderShades();
                }
            })
            // .on("mousemove", (onRectMouseMove || null) as null)
            .on("mouseleave", (onRectMouseLeave || null) as null);

        merged2
            .on("mousedown", function (event, d) {
                brushing = true;
                const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                if (rangeBrushing === null) rangeBrushing = [idx, idx];
                else rangeBrushing = null;
                console.debug("brushing start", rangeBrushing);
                event.stopPropagation();
            })
            .on("mouseup", function (event, d) {
                if (rangeBrushing) {
                    const idx = _.findIndex(bins[0], bin => bin.x == d.x);
                    rangeBrushing[1] = idx;
                    const x0 = bins[0][Math.min(...rangeBrushing)].x0,
                        x1 = bins[0][Math.max(...rangeBrushing)].x1;
                    console.log("select range:", x0, x1, d3.max(_.flatten(data)));
                    onSelectRange && onSelectRange([x0 as number, x1 as number]);
                } else {
                    onSelectRange && onSelectRange();
                }
                brushing = false;
                renderShades();
                console.debug("brushing end");
            });
    }
    else if (rangeSelector === 'as-a-whole') {
        const selectorBase = getChildOrAppend<SVGGElement, SVGElement>(root, "g", "selector-base")
            .attr(
                "transform",
                `translate(${margin.left}, ${margin.top})`
            );

        const selectorSheet = getChildOrAppend<SVGRectElement, SVGGElement>(selectorBase, "rect", "selector-sheet")
            .attr("x", xRange[0])
            .attr("y", xRange[0])
            .attr("width", xRange[1] - xRange[0])
            .attr("height", yRange[1] - yRange[0])

        let _selectedRange: [number, number] = selectedRange ? [layout.x(selectedRange[0]), layout.x(selectedRange[1])] : [0, 0];
        let handling: 'left' | 'right' = 'left';

        const updateSelectorBox = (range: [number, number]) => {

            return getChildOrAppend(selectorBase, "rect", "selector")
                .attr("x", Math.min(range[1], range[0]))
                .attr("y", yRange[0])
                .attr("width", Math.abs(range[1] - range[0]))
                .attr("height", yRange[1] - yRange[0])
            // .on("click", () => updateSelectorBox([0, 0])); 
        }
        updateSelectorBox(_selectedRange);
    }
}