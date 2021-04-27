import * as d3 from "d3";
import * as _ from "lodash";
import { getScaleLinear, isArrays } from "./common";
import { transMax } from '../data/common';

export interface HistogramLayoutStyle {
    height: number,
    width: number,
    mode: 'normal' | 'side-by-side' | 'stacked',
    direction: 'up' | 'down',
    innerPadding: number,
    groupInnerPadding: number,
    xScale?: d3.ScaleLinear<number, number>,
    yScale?: d3.ScaleLinear<number, number>,
    ticks?: number[],
}

const defaultHistogramLayoutStyle: HistogramLayoutStyle = {
    height: 60,
    width: 100,
    mode: 'side-by-side',
    direction: 'up',
    innerPadding: 1,
    groupInnerPadding: 0,
}

export interface HistogramLayoutProps extends Partial<HistogramLayoutStyle> {
    data: number[] | number[][],
}

export interface BinLayout extends d3.Bin<number, number> {
    x: number,
    y: number,
    width: number,
    height: number,
}

export default class HistogramLayout {
    private _data: number[][];
    private _style: HistogramLayoutStyle;
    private _histogram: d3.HistogramGeneratorNumber<number, number>;
    private _bins: d3.Bin<number, number>[][];

    constructor(props: HistogramLayoutProps) {
        const { data } = props;
        this._data = isArrays(data) ? data : [data];
        this._style = { ...defaultHistogramLayoutStyle, ...props };

        if (this._style.xScale === undefined) this._style.xScale = this.getXScale();
        if (this._style.ticks === undefined) this._style.ticks = this.getTicks();

        this._histogram = d3.bin()
            .domain(this.x.domain() as [number, number])
            .thresholds(this._style.ticks!);
        this._bins = this._data.map(d => this._histogram(d));

        if (this._style.yScale === undefined) this._style.yScale = this.getYScales();
    }

    private getXScale(): d3.ScaleLinear<number, number> {
        return getScaleLinear(this.xRange[0], this.xRange[1], _.flatten(this._data));
    }

    private getTicks() {
        const tickNum = d3.thresholdSturges(_.flatten(this._data));
        return this.x.ticks(tickNum);
    }

    private getYScales(): d3.ScaleLinear<number, number> {
        const yMax = this._style.mode === 'side-by-side' ?
            d3.max(this._bins, bs => d3.max(bs, d => d.length)) :
            d3.max(transMax(this._bins), bs => d3.sum(bs, d => d.length));
        return d3.scaleLinear().range(this.yRange).domain([0, yMax || 1]);;
    }

    public get xRange(): [number, number] {
        return [0, this._style.width]
    }

    public get yRange(): [number, number] {
        const { direction, height } = this._style;
        return direction === 'down' ? [0, height] : [height, 0];
    }

    public get x(): d3.ScaleLinear<number, number> {
        return this._style.xScale!;
    }

    public get y(): d3.ScaleLinear<number, number> {
        return this._style.yScale!;
    }

    public get ticks() {
        return this._style.ticks;
    }

    public get groupedBarWidth() {
        const nBins = this._bins[0].length;
        return (this.xRange[1] - this.xRange[0]) / nBins;
    }

    public get barWidth() {
        const nGroups = this._bins.length;
        const groupedBarWidth = this.groupedBarWidth - this._style.innerPadding;
        return Math.max(this._style.mode === 'side-by-side' ?
            (groupedBarWidth / nGroups - this._style.groupInnerPadding) : groupedBarWidth, 1)
    }

    public get layout(): BinLayout[][] {
        if (this._style.mode === 'normal' || this._style.mode === 'side-by-side') {
            return this._bins.map((bins, groupId) => bins.map((bin, binId) => {
                const Layout: BinLayout = {
                    ...bin,
                    x: this.x(bin.x0 as number) + groupId * (this.barWidth + this._style.groupInnerPadding),
                    y: Math.min(this.y(bin.length), this.y(0)),
                    width: this.barWidth,
                    height: Math.abs(this.y(bin.length) - this.y(0)),
                } as BinLayout;
                return Layout;
            }))
        }
        else {
            return this._bins.map((bins, groupId) => bins.map((bin, binId) => {
                const y1 = this.y(d3.sum(this._bins.map(bins => bins[binId].length).filter((d, i) => i < groupId)));
                const y2 = this.y(d3.sum(this._bins.map(bins => bins[binId].length).filter((d, i) => i <= groupId)));
                const Layout: BinLayout = {
                    ...bin,
                    x: this.x(bin.x0 as number),
                    y: Math.min(y1, y2),
                    width: this.barWidth,
                    height: Math.abs(y2 - y1),
                } as BinLayout;
                return Layout;
            }))
        }
    }
}