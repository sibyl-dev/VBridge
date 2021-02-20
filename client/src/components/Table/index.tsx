import * as React from "react";
import * as dataForge from "data-forge"
import { AutoSizer, Grid, GridCellProps, CellMeasurer, CellMeasurerCache, } from "react-virtualized"
import 'react-virtualized/styles.css';
import './index.css'

export interface PureTableProps {
    dataFrame: dataForge.DataFrame,
    className?: string,
    drawIndex?: boolean,
}

export interface PureTableStates {
    headerHeight: number,
    rowHeight: number,
    rowWidth: number
}

export default class PureTable extends React.Component<PureTableProps, PureTableStates>{
    private _cache: CellMeasurerCache
    constructor(props: PureTableProps) {
        super(props);

        this.state = {
            headerHeight: 30,
            rowHeight: 30,
            rowWidth: 80
        }
        this._cache = new CellMeasurerCache({
            defaultWidth: 120,
            minWidth: 60,
            fixedHeight: true
        });

        this._cellRenderer = this._cellRenderer.bind(this);
        this._headerRenderer = this._headerRenderer.bind(this);
        this._contentRenderer = this._contentRenderer.bind(this);
    }

    private _cellRenderer(cellProps: GridCellProps) {
        const { rowIndex, columnIndex, key, style, parent } = cellProps;
        const { dataFrame, drawIndex } = this.props
        const columnData = dataFrame.getColumns().toArray();
        return (
            <CellMeasurer
                cache={this._cache}
                columnIndex={columnIndex}
                key={key}
                parent={parent}
                rowIndex={rowIndex}
            >
                {({ registerChild }) => (
                    (rowIndex === 1) ?
                        this._headerRenderer(cellProps, registerChild as (instance: HTMLDivElement | null) => void) :
                        this._contentRenderer(cellProps, registerChild as (instance: HTMLDivElement | null) => void)
                        // this._headerRenderer(cellProps) :
                        // this._contentRenderer(cellProps)
                )}
            </CellMeasurer>
        );
    }

    private _headerRenderer(cellProps: GridCellProps,
        registerChild?: (instance: HTMLDivElement | null) => void) {
        const { rowIndex, key, style, parent } = cellProps;
        const { dataFrame, drawIndex } = this.props;
        const columnIndex = cellProps.columnIndex + (drawIndex ? 0 : 1);
        return <div
            className={`cell cell-content row-${rowIndex} col-${columnIndex}`}
            key={key}
            style={style}
            ref={registerChild as ((instance: HTMLDivElement | null) => void)}
        >
            {dataFrame.getColumns().at(columnIndex)?.name}
        </div>
    }

    private _contentRenderer(cellProps: GridCellProps,
        registerChild?: (instance: HTMLDivElement | null) => void) {
        const { key, style, parent } = cellProps;
        const { dataFrame, drawIndex } = this.props;
        const columnIndex = cellProps.columnIndex + (drawIndex ? 0 : 1);
        const rowIndex = cellProps.rowIndex - 1;
        return <div
            className={`cell cell-header row-${rowIndex} col-${columnIndex}`}
            key={key}
            style={style}
            ref={registerChild as ((instance: HTMLDivElement | null) => void)}
        >
            {dataFrame.getColumns().at(columnIndex)?.series.at(rowIndex)}
        </div>
    }

    public render() {
        const { headerHeight, rowHeight, rowWidth } = this.state;
        const { className, dataFrame, drawIndex } = this.props;
        const columnCount = dataFrame.getColumns().count() + (drawIndex ? 0 : 1)
        return <div className={"table-container" + (className ? ` ${className}` : "")}>
            <AutoSizer>
                {({ width, height }) => (
                    <div style={{ overflow: "visible" }}>
                        <Grid
                            height={height}
                            width={width}
                            rowHeight={rowHeight}
                            rowCount={dataFrame.count()}
                            deferredMeasurementCache={this._cache}
                            columnCount={columnCount}
                            columnWidth={this._cache.columnWidth}
                            cellRenderer={this._cellRenderer}
                        />
                    </div>
                )}
            </AutoSizer>
        </div>
    }
}