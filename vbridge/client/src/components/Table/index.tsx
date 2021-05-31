import * as React from "react";
import * as dataForge from "data-forge"
import { AutoSizer, MultiGrid, GridCellProps, CellMeasurer, CellMeasurerCache, Index, } from "react-virtualized"
import 'react-virtualized/styles.css';
import './index.css'
import { Entity, getColumnWidth } from "type/entity";

export interface PureTableProps {
    dataFrame: dataForge.IDataFrame<number, any>,
    // dataFrame: any[][],
    className?: string,
    drawIndex?: boolean,
    rowWidth?: number | (number | ((params: Index) => number)),
    rowHeight?: number,
}

export interface PureTableStates {
    columnNames: string[];
}

export default class PureTable extends React.Component<PureTableProps, PureTableStates>{
    private _cache: CellMeasurerCache;
    constructor(props: PureTableProps) {
        super(props);

        this.state = { columnNames: props.dataFrame.getColumnNames() }

        this._cache = new CellMeasurerCache({
            defaultWidth: 120,
            minHeight: 30,
            fixedWidth: true
        });

        this._cellRenderer = this._cellRenderer.bind(this);
        this._headerRenderer = this._headerRenderer.bind(this);
        this._contentRenderer = this._contentRenderer.bind(this);
    }

    componentDidUpdate(prevProps: PureTableProps) {
        if (prevProps.dataFrame != this.props.dataFrame)
            this.setState({ columnNames: this.props.dataFrame.getColumnNames() });
    }

    private _cellRenderer(cellProps: GridCellProps) {
        const { rowIndex, columnIndex, key, parent } = cellProps;
        return (
            <CellMeasurer
                cache={this._cache}
                columnIndex={columnIndex}
                key={key}
                parent={parent}
                rowIndex={rowIndex}
            >
                {({ registerChild }) => (
                    (rowIndex === 0) ?
                        this._headerRenderer(cellProps, registerChild as (instance: HTMLDivElement | null) => void) :
                        this._contentRenderer(cellProps, registerChild as (instance: HTMLDivElement | null) => void)
                )}
            </CellMeasurer>
        );
    }

    private _headerRenderer(cellProps: GridCellProps,
        registerChild?: (instance: HTMLDivElement | null) => void) {
        const { key, style } = cellProps;
        const { dataFrame: dataFrame, drawIndex } = this.props;
        const columnIndex = cellProps.columnIndex + (drawIndex ? 0 : 1);
        return <div
            className={`cell cell-header col-${columnIndex}`}
            key={key}
            style={style}
            ref={registerChild as ((instance: HTMLDivElement | null) => void)}
        >
            {this.state.columnNames[columnIndex]}
        </div>
    }

    private _contentRenderer(cellProps: GridCellProps,
        registerChild?: (instance: HTMLDivElement | null) => void) {
        const { key, style } = cellProps;
        const { dataFrame, drawIndex } = this.props;
        const columnIndex = cellProps.columnIndex + (drawIndex ? 0 : 1);
        const columnName = this.state.columnNames[columnIndex]
        const rowIndex = cellProps.rowIndex - 1;
        return <div
            className={`cell cell-content row-${rowIndex} col-${columnIndex}`}
            key={key}
            style={style}
            ref={registerChild as ((instance: HTMLDivElement | null) => void)}
        >
            {dataFrame.at(rowIndex)[columnName]}
        </div>
    }

    public render() {
        const { className, dataFrame: entity, drawIndex, rowHeight, rowWidth } = this.props;
        const columnCount = entity.getColumns().count() - (drawIndex ? 0 : 1);
        const columnWidth = rowWidth || getColumnWidth(entity, drawIndex, 150, 60);
        return <div className={"table-container" + (className ? ` ${className}` : "")}>
            <AutoSizer>
                {({ width, height }) => (
                    <div style={{ overflow: "visible" }}>
                        <MultiGrid
                            height={height}
                            width={width}
                            rowHeight={rowHeight || this._cache.rowHeight}
                            rowCount={entity.count() + 1}
                            columnCount={columnCount}
                            columnWidth={columnWidth || this._cache.columnWidth}
                            cellRenderer={this._cellRenderer}
                            fixedRowCount={1}
                            fixedColumnCount={drawIndex ? 1 : 0}
                        />
                    </div>
                )}
            </AutoSizer>
        </div>
    }
}