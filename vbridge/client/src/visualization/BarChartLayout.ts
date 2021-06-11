import * as d3 from "d3";
import * as _ from "lodash";
import { getScaleBand, countCategories, isArrays } from "./common";
import { transMax } from '../utils/common';

export interface BarChartLayoutStyle {
    height: number,
    width: number,
    mode: 'normal' | 'side-by-side' | 'stacked',
    direction: 'up' | 'down',
    innerPadding: number,
    groupInnerPadding: number,
    xScale?: d3.ScaleBand<string>,
    yScale?: d3.ScaleLinear<number, number>,
}

const defaultBarChartLayoutStyle: BarChartLayoutStyle = {
    height: 60,
    width: 100,
    mode: 'side-by-side',
    direction: 'up',
    innerPadding: 1,
    groupInnerPadding: 0,
}

export interface BarChartLayoutProps extends Partial<BarChartLayoutStyle> {
    data: string[] | string[][],
}

interface Bin<T> {
    count: number;
    name: T;
  };

export interface BinLayout<T> extends Bin<T> {
    x: number,
    y: number,
    width: number,
    height: number,
}

export default class BarChartLayout {
    private _data: string[][];
    private _style: BarChartLayoutStyle;
    private _bins: Bin<string>[][];

    constructor(props: BarChartLayoutProps) {
        const { data } = props;
        this._data = isArrays(data) ? data : [data];
        this._style = { ...defaultBarChartLayoutStyle, ...props };

        if (this._style.xScale === undefined) this._style.xScale = this.getXScale();
        this._bins = this._data.map(d => countCategories(d));
        if (this._style.yScale === undefined) this._style.yScale = this.getYScales();
    }

    private getXScale(): d3.ScaleBand<string> {
        return getScaleBand(this.xRange[0], this.xRange[1], _.flatten(this._data));
    }

    private getYScales(): d3.ScaleLinear<number, number> {
        const yMax = this._style.mode === 'side-by-side' ?
            d3.max(this._bins, bs => d3.max(bs, d => d.count)) :
            d3.max(transMax(this._bins), bs => d3.sum(bs, d => d.count));
        return d3.scaleLinear().range(this.yRange).domain([0, yMax || 1]);;
    }

    public get xRange(): [number, number] {
        return [0, this._style.width]
    }

    public get yRange(): [number, number] {
        const { direction, height } = this._style;
        return direction === 'down' ? [0, height] : [height, 0];
    }

    public get x(): d3.ScaleBand<string> {
        return this._style.xScale!;
    }

    public get y(): d3.ScaleLinear<number, number> {
        return this._style.yScale!;
    }

    public get groupedBarWidth() {
        return this.x.bandwidth();
    }

    public get barWidth() {
        const nGroups = this._bins.length;
        const groupedBarWidth = this.groupedBarWidth - this._style.innerPadding;
        return Math.max(this._style.mode === 'side-by-side' ?
            (groupedBarWidth / nGroups - this._style.groupInnerPadding) : groupedBarWidth, 1)
    }

    public get layout(): BinLayout<string>[][] {
        if (this._style.mode === 'normal' || this._style.mode === 'side-by-side') {
            return this._bins.map((bins, groupId) => bins.map((bin, binId) => {
                const Layout = {
                    ...bin,
                    x: this.x(bin.name)! + groupId * (this.barWidth + this._style.groupInnerPadding),
                    y: Math.min(this.y(bin.count), this.y(0)),
                    width: this.barWidth,
                    height: Math.abs(this.y(bin.count) - this.y(0)),
                } as BinLayout<string>;
                return Layout;
            }))
        }
        else {
            return this._bins.map((bins, groupId) => bins.map((bin, binId) => {
                const y1 = this.y(d3.sum(this._bins.map(bins => bins[binId].count).filter((d, i) => i < groupId)));
                const y2 = this.y(d3.sum(this._bins.map(bins => bins[binId].count).filter((d, i) => i <= groupId)));
                const Layout = {
                    ...bin,
                    x: this.x(bin.name)!,
                    y: Math.min(y1, y2),
                    width: this.barWidth,
                    height: Math.abs(y2 - y1),
                } as BinLayout<string>;
                return Layout;
            }))
        }
    }
}