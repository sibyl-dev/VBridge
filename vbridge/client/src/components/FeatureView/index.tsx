import * as React from "react";
import * as d3 from "d3";
import * as _ from "lodash"
import { Button, Tooltip, Popover, Slider } from "antd"
import { DataFrame, IDataFrame } from "data-forge";
import { getScaleLinear, beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import {
    ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, CaretRightOutlined,
    FilterOutlined, LineChartOutlined, QuestionOutlined, SortAscendingOutlined, TableOutlined
} from "@ant-design/icons"
import { buildShowStateList, Feature, VFeature } from "type";
import AreaChart from "visualization/AreaChart";
import BarChart from "visualization/BarChart";
import { getReferenceValue, isDefined } from "utils/common";

import "./index.scss"
import { SHAPContributions } from "./SHAPBand";
import { StatValues } from "type/resource";

export interface FeatureViewProps {
    className?: string,
    features: IDataFrame<number, Feature>,
    featureMat?: IDataFrame<number, any>,
    prediction?: number,

    display?: 'normal' | 'dense',
    focusedFeatures: string[],
    entityCategoricalColor?: (entityName: string | undefined) => string,

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureViewStates {
    desiredFM?: IDataFrame<number, any>,
    undesiredFM?: IDataFrame<number, any>,
    referenceValues?: IDataFrame<string, StatValues>,
}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {

    constructor(props: FeatureViewProps) {
        super(props);

        this.state = {};
        this.defaultCellWidth = this.defaultCellWidth.bind(this);
        this.updateReferenceValues = this.updateReferenceValues.bind(this);
    }

    componentDidMount() {
        this.updateReferenceValues();
    }

    // run when the group ids updates
    private updateReferenceValues() {
        const { featureMat } = this.props;
        if (featureMat) {
            const desiredFeatureMat = featureMat.where(row => row['complication'] === 0);
            const undesiredFeatureMat = featureMat.where(row => row['complication'] !== 0);
            if (desiredFeatureMat.count() == 0) alert("No patient in the selection.");
            else {
                const featureIds = featureMat.getColumnNames();
                const referenceValues = new DataFrame({
                    index: featureIds,
                    values: featureIds.map(name =>
                        getReferenceValue(desiredFeatureMat.getSeries(name).toArray())
                    )
                })
                this.setState({ desiredFM: desiredFeatureMat, undesiredFM: undesiredFeatureMat, referenceValues });
            }
        }
    }

    private defaultCellWidth(id: number) {
        const width = [150, 100, 150];
        return width[id];
    }

    componentDidUpdate(prevProps: FeatureViewProps) {
        const { features, featureMat } = this.props;
        if (prevProps.featureMat != featureMat || prevProps.features != features) {
            this.updateReferenceValues();
        }
    }

    public render() {
        const { features, entityCategoricalColor, ...rest } = this.props;
        const { desiredFM: desiredFeatureMat, undesiredFM: undesiredFeatureMat, referenceValues } = this.state;
        const contextFeatureValues = [];
        if (desiredFeatureMat) contextFeatureValues.push(desiredFeatureMat);
        if (undesiredFeatureMat) contextFeatureValues.push(undesiredFeatureMat);

        return (
            <div className="feature-view">
                <FeatureList
                    {...rest}
                    features={features}
                    cellWidth={this.defaultCellWidth}
                    referenceMat={contextFeatureValues}
                    referenceValues={referenceValues}
                    entityCategoricalColor={entityCategoricalColor}
                />
            </div>
        )
    }
}

export interface FeatureListProps {
    className?: string,
    features: IDataFrame<number, Feature>,
    shapValues?: number[],
    prediction?: number,
    cellWidth: (id: number) => number,
    referenceMat: IDataFrame<number, any>[],
    referenceValues?: IDataFrame<string, StatValues>,

    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    entityCategoricalColor?: (entityName: string | undefined) => string,

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
}

export interface FeatureListStates {
    // Contribution sorting order
    order?: 'ascending' | 'dscending',
    threshold?: [number, number],
    VFeatureList: VFeature[],
}

export class FeatureList extends React.Component<FeatureListProps, FeatureListStates> {
    constructor(props: FeatureListProps) {
        super(props);

        this.state = { order: 'dscending', VFeatureList: buildShowStateList(props.features.toArray()) };

        this.onClick = this.onClick.bind(this);
        this.sortFeatures = this.sortFeatures.bind(this);
        this.getContributionXScale = this.getContributionXScale.bind(this);
        this.flipShowState = this.flipShowState.bind(this);
    }

    private onClick(newOrder?: 'ascending' | 'dscending') {
        this.setState({ order: newOrder })
    }

    componentDidUpdate(prevProps: FeatureListProps) {
        if (prevProps.features != this.props.features) {
            this.setState({ VFeatureList: buildShowStateList(this.props.features.toArray()) });
        }
    }

    private flipShowState(feature: Feature) {
        const { VFeatureList } = this.state;
        for (const vFeature of VFeatureList) {
            if (vFeature.id === feature.id) {
                vFeature.show = !vFeature.show;
                vFeature.children?.forEach(f => f.show = !f.show);
            }
        }
        this.setState({ VFeatureList });
    }

    private sortFeatures(features: IDataFrame<number, any>): IDataFrame<number, any> {
        const { order } = this.state;
        if (order === 'ascending')
            features = features.orderBy(row => row.shap);
        else if (order == 'dscending')
            features = features.orderBy(row => -row.shap);
        return features.select(feature => {
            if (feature.children) {
                return {
                    ...feature,
                    children: this.sortFeatures(feature.children)
                }
            }
            else return feature
        })
    }

    private getContributionXScale() {
        const { cellWidth } = this.props;
        const { VFeatureList } = this.state;
        const features = VFeatureList.filter(f => f.show);
        const contr = features.map(f => f.shap).map(v => Math.abs(v));
        const whatifContr = features.map(f => f.whatIfShap).filter(isDefined).map(v => Math.abs(v));
        const maxAbsCont = _.max([...contr, ...whatifContr]) as number;
        return getScaleLinear(0, cellWidth(2), undefined, [-maxAbsCont, maxAbsCont]);
    }

    public render() {
        const { features, cellWidth, shapValues, ...rest } = this.props;
        const { order, threshold } = this.state;
        const sortedFeatures = this.sortFeatures(features);
        const shapMin = _.min(shapValues);
        const shapMax = _.max(shapValues);
        const x = this.getContributionXScale();

        return <div style={{ width: "100%" }}>
            <div style={{ width: "100%" }}>
                <div className="feature-header">
                    <div className="feature-header-cell" style={{ width: cellWidth(0) }}>
                        <span>Name</span>
                        <Button type="text" className={'header-buttion'} icon={<SortAscendingOutlined />} />
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(1) }}>
                        <span>Contribution</span>
                    </div>
                    <div className="feature-header-cell" style={{ width: cellWidth(2) }}>
                        <span>Contribution</span>
                        {order === 'dscending' ?
                            <Button type="text" className={'header-buttion'} icon={<ArrowDownOutlined />}
                                onClick={this.onClick.bind(this, 'ascending')} />
                            : <Button type="text" className={'header-buttion'} icon={<ArrowUpOutlined />}
                                onClick={this.onClick.bind(this, 'dscending')} />}
                        <Popover placement="right" content={
                            <div style={{ width: 160, height: 20 }} onMouseDown={(event) => event.stopPropagation()}>
                                {shapValues && <Slider
                                    tipFormatter={null}
                                    range defaultValue={[_.sortBy(shapValues, d => d)[shapValues.length - 5], shapMax!]}
                                    min={shapMin!} max={shapMax!} step={(shapMax! - shapMin!) / 100}
                                    onAfterChange={(range) => this.setState({ threshold: range })}
                                />}
                            </div>
                        } trigger="click">
                            <Button type="text" className={'header-buttion'} icon={<FilterOutlined />} />
                        </Popover>
                    </div>
                </div>
                <div className="feature-content">
                    {sortedFeatures?.toArray().map(row =>
                        <FeatureBlock
                            {...rest}
                            feature={row}
                            depth={0}
                            x={x}
                            cellWidth={cellWidth}
                            key={row.name || row.alias}
                            threshold={threshold}
                            onCollapse={this.flipShowState}
                        />
                    )}
                </div>
            </div>
        </div>
    }
}

export interface FeatureBlockProps {
    className?: string,
    depth: number,
    feature: Feature,
    prediction?: number,
    referenceMat: IDataFrame<number, any>[],
    referenceValues?: IDataFrame<string, StatValues>,
    x: d3.ScaleLinear<number, number>,
    cellWidth: (id: number) => number,
    entityCategoricalColor?: (entityName: string | undefined) => string,
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    threshold?: [number, number],

    inspectFeatureInSignal?: (feature: Feature) => void,
    inspectFeatureInTable?: (feature: Feature) => void,
    onCollapse?: (feature: Feature) => void;
}
export interface FeatureBlockStates {
    collapsed: boolean,
    showDistibution: boolean,
    showWhatIf: boolean,
}

export class FeatureBlock extends React.Component<FeatureBlockProps, FeatureBlockStates> {
    constructor(props: FeatureBlockProps) {
        super(props);
        this.state = {
            collapsed: true,
            showDistibution: false,
            showWhatIf: false
        }

        this.onClickButton = this.onClickButton.bind(this);
        this.onClickDiv = this.onClickDiv.bind(this);
        this.hasFeature = this.hasFeature.bind(this);
    }

    private hasFeature(feature: Feature, featureNames: string[]): boolean {
        if (feature.id && featureNames.includes(feature.id))
            return true;
        if (feature.children?.where(row => this.hasFeature(row, featureNames)).count())
            return true;
        else
            return false
    }

    protected onClickButton() {
        const { onCollapse, feature } = this.props;
        this.setState({ collapsed: !this.state.collapsed });
        window.setTimeout(() => onCollapse && onCollapse(feature), 500);
    }

    protected onClickDiv() {
        this.setState({ showDistibution: !this.state.showDistibution });
    }

    render() {
        const { feature, x, cellWidth, entityCategoricalColor, inspectFeatureInSignal, inspectFeatureInTable,
            className, depth, referenceMat: contextFeatureValues, focusedFeatures, referenceValues, display,
            prediction, threshold } = this.props;
        const { collapsed, showDistibution, showWhatIf } = this.state
        const { id: name, alias, value, shap, children, entityId, whatIfPred: predictionIfNormal } = feature;
        const referenceValue = referenceValues ? referenceValues.at(feature.id) : undefined;

        let outofRange: 'none' | 'low' | 'high' = 'none';
        let whatIfValue = undefined;
        if (referenceValue && typeof (value) === typeof (0.0)) {
            const { ci95 } = referenceValue;
            if (value as number > ci95[1]) {
                outofRange = 'high'
                whatIfValue = ci95[1]
            }
            else if (value as number < ci95[0]) {
                outofRange = 'low'
                whatIfValue = ci95[0]
            }
        }
        let showState: 'normal' | 'focused' | 'unfocused' | 'none' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }
        if (display && display === 'dense') {
            if (showState === 'unfocused') showState = 'none';
        }
        if (threshold) {
            // higher is allowed
            if (shap < threshold[0])
                if (showState !== 'focused') showState = 'none';
        }

        const heigth = showDistibution ? 80 : 30;
        const isLeaf = !feature.children || feature.children.count() === 0;

        let id: string | undefined = undefined
        if (isLeaf)
            id = `${className}-${feature.id}`;
        else if (collapsed) {
            const childrenNames = feature.children?.getSeries('name').where(d => d);
            if (childrenNames && childrenNames.count()) {
                id = `${className}-${childrenNames.first()}`;
            }
        }

        return <div>
            <div className="feature-row" style={{
                display: (showState === 'none') ? "none" : "flex", justifyContent: "flex-end", position: "relative",
                width: `calc(100% - ${depth * 10}px)`, left: `${depth * 10}px`
            }}>
                <div style={{ width: 20 }}>
                    {children && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={`feature-block ${showState}` + (collapsed ? "" : " expanded")}
                    id={id}
                    style={{
                        height: heigth, borderRightWidth: 4,
                        borderRightColor: entityCategoricalColor && entityCategoricalColor(entityId)
                    }}
                    onClick={children ? this.onClickButton : this.onClickDiv}>
                    <div className={`feature-block-inner`}>
                        <Tooltip title={alias}>
                            <div className="feature-block-cell feature-name" style={{ width: cellWidth(0) - 10 * depth }}>
                                <span className={"feature-block-cell-text"}>{showDistibution ? alias : beautifulPrinter(alias, 22)}</span>
                            </div>
                        </Tooltip>
                        <div className={"feature-block-cell" + (isLeaf ? " feature-value" : "")}
                            style={{ width: showDistibution ? cellWidth(1) + 40 : cellWidth(1) }}>
                            {showDistibution ?
                                (typeof (value) === 'number') ? <AreaChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as number[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    referenceValue={value as number}
                                    whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : (typeof (value) === 'string') ? <BarChart
                                    data={contextFeatureValues?.map(mat => mat.getSeries(name).toArray()) as string[][]}
                                    height={70}
                                    width={cellWidth(1) + 40}
                                    drawBottomAxis={true}
                                    margin={{ left: 10, bottom: 20 }}
                                    // referenceValue={value}
                                    // whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    mode="side-by-side"
                                /> : <div />
                                : <Tooltip title={typeof (value) == typeof (0.0) ? beautifulPrinter(value) : value}>
                                    <span className={"feature-block-cell-text"}>
                                        {outofRange === 'low' && <ArrowDownOutlined />}
                                        {beautifulPrinter(value)}
                                        {outofRange === 'high' && <ArrowUpOutlined />}
                                    </span>
                                </Tooltip>}
                        </div>
                        <div className={"feature-block-cell feature-contribution"} style={{ width: cellWidth(2) }}>
                            {SHAPContributions({
                                contribution: feature.shap, 
                                contributionIfNormal: showWhatIf ? feature.whatIfShap : undefined, 
                                x, height: 14,
                                posRectStyle: { fill: !collapsed ? '#f8a3bf' : undefined },
                                negRectStyle: { fill: !collapsed ? '#9abce4' : undefined }
                            })}
                            {(shap > x.domain()[1]) && <ArrowRightOutlined className="overflow-notation-right" />}
                            {(shap < x.domain()[0]) && <ArrowLeftOutlined className="overflow-notation-left" />}
                            {showWhatIf && whatIfValue && <div className={"what-if-label"}>
                                {prediction && <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(prediction)) }}>
                                    {prediction > 0.5 ? 'High' : 'Low'}
                                </div>}
                                <ArrowRightOutlined />
                                {predictionIfNormal && <div className={"label-circle"} style={{ backgroundColor: defaultCategoricalColor(Math.round(predictionIfNormal)) }}>
                                    {predictionIfNormal > 0.5 ? 'High' : 'Low'}
                                </div>}
                            </div>}
                        </div>
                    </div>
                </div>
                {(isLeaf || collapsed) && <span className={`feature-block-annote ${showState}`} style={{
                    backgroundColor: entityCategoricalColor && entityCategoricalColor(entityId),
                    height: heigth
                }} />}
                <Button size="small" type="primary" shape="circle"
                    icon={<LineChartOutlined />} onClick={() => inspectFeatureInSignal && inspectFeatureInSignal(feature)}
                    className={"feature-button-linechart"}
                />
                <Button size="small" type="primary" shape="circle"
                    icon={<TableOutlined />} onClick={() => inspectFeatureInTable && inspectFeatureInTable(feature)}
                    className={"feature-button-table"}
                />
                {showDistibution && isLeaf && outofRange !== 'none' && <Button size="small" type="primary" shape="circle"
                    icon={<QuestionOutlined />} onClick={() => this.setState({ showWhatIf: !showWhatIf })}
                    className={"feature-button-what-if"}
                />}

            </div>

            {(!collapsed) && children?.toArray().map(feature =>
                <FeatureBlock
                    {...this.props}
                    key={feature.id || `${feature.entityId}-${feature.alias}`}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}