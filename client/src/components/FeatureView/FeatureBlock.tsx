import React from "react";

import {
    CaretRightOutlined, ArrowDownOutlined, ArrowUpOutlined, LineChartOutlined,
    TableOutlined, QuestionOutlined
} from "@ant-design/icons";
import { ArrowRightOutlined, ArrowLeftOutlined } from "@material-ui/icons";
import { Tooltip, Button } from "antd";
import { IDataFrame } from "data-forge";
import { Feature, isCategoricalFeature, isGroupFeature, isNumericalFeature } from "type";
import { StatValues } from "type/resource";
import AreaChart from "visualization/AreaChart";
import BarChart from "visualization/BarChart";
import { ColorManager } from "visualization/color";
import { beautifulPrinter } from "visualization/common";
import { SHAPContributions } from "./SHAPBand";
import _ from "lodash";

export interface FeatureBlockProps {
    className?: string,
    depth: number,
    feature: Feature,
    target?: string,
    prediction?: number,
    referenceMat?: Record<string, any[][]>,
    referenceValues?: IDataFrame<string, StatValues>,
    x: d3.ScaleLinear<number, number>,
    colorManager?: ColorManager
    focusedFeatures: string[],
    display?: 'normal' | 'dense',
    threshold?: number,

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
        if (isGroupFeature(feature) && feature.children.where(row =>
            this.hasFeature(row, featureNames)).count())
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

    protected getBlockId() {
        const { className, feature } = this.props;
        const { collapsed } = this.state;
        let id: string | undefined = undefined;
        if (!isGroupFeature(feature) || feature.children.count() === 0)
            id = `${className}-${feature.id}`;
        else if (collapsed) {
            const childrenNames = feature.children?.getSeries('name').where(d => d);
            if (childrenNames && childrenNames.count()) {
                id = `${className}-${childrenNames.first()}`;
            }
        }
        return id
    }

    protected outOfRange() {
        const { referenceValues, feature } = this.props;
        const ref = referenceValues && referenceValues.at(feature.id);
        let outofRange: 'none' | 'low' | 'high' = 'none';
        let whatIfValue = undefined;
        if (ref && isNumericalFeature(feature)) {
            if (feature.value > ref.ci95[1]) {
                outofRange = 'high'
                whatIfValue = ref.ci95[1]
            }
            else if (feature.value < ref.ci95[0]) {
                outofRange = 'low'
                whatIfValue = ref.ci95[0]
            }
        }
        return { outofRange, whatIfValue }
    }

    protected getShowState() {
        const { focusedFeatures, feature, display, threshold } = this.props;
        const { shap } = feature;
        let showState: 'normal' | 'focused' | 'unfocused' | 'none' = 'normal';
        if (focusedFeatures.length > 0) {
            if (this.hasFeature(feature, focusedFeatures)) showState = 'focused';
            else showState = 'unfocused';
        }
        if (display && display === 'dense') {
            if (showState === 'unfocused') showState = 'none';
        }
        if (threshold !== undefined) {
            // higher is allowed
            if (Math.abs(shap) < threshold)
                if (showState !== 'focused') showState = 'none';
        }
        return showState
    }

    render() {
        const { feature, x, colorManager, inspectFeatureInSignal, inspectFeatureInTable,
            depth, target, prediction, referenceMat } = this.props;
        const { collapsed, showDistibution, showWhatIf } = this.state
        const { id, alias, shap, entityId, whatIfPred, whatIfShap } = feature;
        const { outofRange, whatIfValue } = this.outOfRange();

        const showState = this.getShowState();
        const isLeaf = !isGroupFeature(feature) || feature.children.count() === 0;
        const featureValue = isNumericalFeature(feature) ? beautifulPrinter(feature.value) : feature.value;
        const entityColor = colorManager && colorManager.entityColor(entityId);
        const predColor = (target && prediction) ? colorManager?.labelColor(target, prediction) : undefined;
        const whatifPredColor = (target && whatIfPred) ? colorManager?.labelColor(target, whatIfPred) : undefined;

        const depthMargin = 10 * depth;
        const nameCellWidth = 150 - depthMargin;

        return <div>
            <div className="feature-row" style={{
                display: (showState === 'none') ? "none" : "flex",
                width: `calc(100% - ${depthMargin}px)`, left: `${depthMargin}px`
            }}>
                <div style={{ width: 20 }}>
                    {isGroupFeature(feature) && <CaretRightOutlined className="right-button"
                        onClick={this.onClickButton} rotate={collapsed ? 0 : 90} />}
                </div>
                <div className={"feature-block"}
                    id={this.getBlockId()}
                    style={{ borderRightColor: entityColor }}
                    onClick={isGroupFeature(feature) ? this.onClickButton : this.onClickDiv}>
                    <div className={`feature-block-inner`}>
                        <Tooltip title={id}>
                            <div className="feature-block-cell feature-name" style={{ width: nameCellWidth }}>
                                <span className={"feature-block-cell-text"}>{beautifulPrinter(alias, 22)}</span>
                            </div>
                        </Tooltip>
                        <div className={"feature-block-cell feature-value" + (isLeaf ? " leaf" : "")}>
                            {showDistibution && referenceMat ?
                                isNumericalFeature(feature) ? <AreaChart
                                    {...defaultChartStyle}
                                    data={referenceMat[id]}
                                    referenceValue={feature.value}
                                    whatIfValue={showWhatIf ? whatIfValue : undefined}
                                    tickNum={20}
                                /> : isCategoricalFeature(feature) ? <BarChart
                                    {...defaultChartStyle}
                                    data={referenceMat[id]}
                                    mode="side-by-side"
                                /> : <div />
                                : <Tooltip title={featureValue}>
                                    <span className={"feature-block-cell-text"}>
                                        {outofRange === 'low' && <ArrowDownOutlined />}
                                        {beautifulPrinter(featureValue)}
                                        {outofRange === 'high' && <ArrowUpOutlined />}
                                    </span>
                                </Tooltip>}
                        </div>
                        <div className={"feature-block-cell feature-contribution"}>
                            {SHAPContributions({
                                contribution: feature.shap,
                                contributionIfNormal: (showWhatIf && showDistibution) ? whatIfShap : undefined,
                                x, height: 14,
                                posRectStyle: { fill: !collapsed ? '#f8a3bf' : undefined },
                                negRectStyle: { fill: !collapsed ? '#9abce4' : undefined }
                            })}
                            {(shap > x.domain()[1]) && <ArrowRightOutlined className="overflow-notation-right" />}
                            {(shap < x.domain()[0]) && <ArrowLeftOutlined className="overflow-notation-left" />}
                            {showWhatIf && whatIfValue && <div className={"what-if-label"}>
                                {prediction && <div className={"label-circle"} style={{ backgroundColor: predColor }}>
                                    {prediction > 0.5 ? 'High' : 'Low'}
                                </div>}
                                <ArrowRightOutlined />
                                {whatIfPred && <div className={"label-circle"} style={{ backgroundColor: whatifPredColor }}>
                                    {whatIfPred > 0.5 ? 'High' : 'Low'}
                                </div>}
                            </div>}
                        </div>
                    </div>
                </div>
                {(isLeaf || collapsed) && <span className={`feature-block-annote ${showState}`} />}
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

            {(!collapsed) && isGroupFeature(feature) && feature.children.toArray().map(feature =>
                <FeatureBlock
                    {...this.props}
                    key={feature.id || `${feature.entityId}-${feature.alias}`}
                    depth={depth + 1}
                    feature={feature}
                />)}
        </div>
    }
}

const defaultChartStyle = {
    height: 70,
    width: 140,
    margin: { left: 10, bottom: 20 },
    drawBottomAxis: true
}