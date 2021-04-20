import * as React from "react";
import { Row, Col, Divider, Button } from "antd"
import { beautifulPrinter, defaultCategoricalColor } from "visualization/common";
import "./index.scss"
import { IDataFrame } from "data-forge";
import { FeatureMeta } from "data/feature";
import { PushpinOutlined } from "@ant-design/icons";

export interface MetaViewProps {
    className?: string,
    patientIds?: number[],
    patientInfoMeta?: { [key: string]: any },
    days?: number,
    featureMeta: IDataFrame<number, FeatureMeta>,
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureNames: string[]) => void,
    entityCategoricalColor?: (entityName: string | undefined) => string,
}

export interface MetaViewStates { }

export type MetaItems = {
    name: string,
    itemNames: string[],
}

export default class MetaView extends React.PureComponent<MetaViewProps, MetaViewStates> {

    private metaItems: MetaItems[];
    private leftMetaItems: MetaItems[];
    private rightMetaItems: MetaItems[];
    private layout: number[] = [1, 10, 1, 11, 1];

    constructor(props: MetaViewProps) {
        super(props);
        this.metaItems = [
            {
                name: 'Demographic',
                itemNames: ['Age', 'GENDER', 'Height', 'Weight', 'LANGUAGE', 'ETHNICITY']
            },
            {
                name: 'Admission',
                itemNames: ['ADMISSION_DEPARTMENT', 'DIAGNOSIS', 'ICD10_CODE_CN', 'INSURANCE']
            },
            {
                name: 'Surgery',
                itemNames: ['SURGERY_NAME', 'SURGERY_POSITION', 'ANES_METHOD',
                    // 'ANES_START_TIME', 'ANES_END_TIME', 'SURGERY_BEGIN_TIME', 'SURGERY_END_TIME',
                    'Surgical time (minutes)', 'CPB time (minutes)', 'Aortic cross-clamping time (times)'
                ]
            }
        ]

        this.leftMetaItems = [
            {
                name: 'Patient Info',
                itemNames: ['Age', 'GENDER', 'Height', 'Weight', 'ADMISSION_DEPARTMENT', 'DIAGNOSIS', 'ICD10_CODE_CN']
            },
            // {
            //     name: 'Admission',
            //     itemNames: ['ADMISSION_DEPARTMENT', 'DIAGNOSIS', 'ICD10_CODE_CN']
            // },
        ]
        this.rightMetaItems = [

            {
                name: 'Surgery Info',
                itemNames: ['SURGERY_NAME', 'SURGERY_POSITION',
                    // 'ANES_START_TIME', 'ANES_END_TIME', 'SURGERY_BEGIN_TIME', 'SURGERY_END_TIME',
                    'Surgical time (minutes)', 'CPB time (minutes)'
                ]
            }
        ]
        this.onHover = this.onHover.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.onPin = this.onPin.bind(this);
    }

    private onHover(name: string) {
        const { updateFocusedFeatures, featureMeta } = this.props;
        const targetFeature = featureMeta.where(row => row.alias === name);
        if (targetFeature.count() > 0)
            updateFocusedFeatures && updateFocusedFeatures([targetFeature.first().name!]);
    }

    private onLeave() {
        const { updateFocusedFeatures } = this.props;
        updateFocusedFeatures && updateFocusedFeatures([]);
    }

    private onPin(name: string) {
        const { updatePinnedFocusedFeatures, featureMeta } = this.props;
        const targetFeature = featureMeta.where(row => row.alias === name);
        if (targetFeature.count() > 0)
            updatePinnedFocusedFeatures && updatePinnedFocusedFeatures([targetFeature.first().name!]);
    }

    public render() {
        const { patientInfoMeta, featureMeta, days, className, entityCategoricalColor } = this.props;
        const featureAlias = featureMeta.getSeries('alias').toArray();
        return (
            <div className={"meta-view"}>
                {patientInfoMeta && this.metaItems.map(metaItem => <div key={metaItem.name}>
                    <Divider className='metaInfoTitle' orientation="center" style={{ margin: 6 }}> {metaItem.name} </Divider>
                    {metaItem.itemNames.map(name => {
                        var value = patientInfoMeta[name]
                        if (name.indexOf("TIME") != -1) {
                            // console.log('TIME', name);
                            value = value.substr(11, 8);
                        }
                        // if(name.indexOf('(minutes)'))
                        //     name = name.replace(/minutes/g, 'mins')
                        if (name == 'Height')
                            name = name + ' (cm)'
                        if (name == 'Weight')
                            name = name + ' (kg)'
                        if (name == 'Age' && days) {
                            let y = Math.floor(days / 360)
                            let m = Math.floor((days % 360) / 30)
                            let d = (days % 360 % 30)
                            value = (y ? y + 'Y ' : '') + (m || y ? m + 'M ' : '') + d + 'D'
                        }

                        return <MetaItem
                            className={className}
                            category={metaItem.name}
                            name={name}
                            key={name}
                            value={value}
                            featureAlias={featureAlias}
                            layout={this.layout}
                            onHover={() => this.onHover(name)}
                            onLeave={this.onLeave}
                            onPin={() => this.onPin(name)}
                            entityCategoricalColor={entityCategoricalColor}
                        />
                    })}
                </div>
                )}
            </div>
        )
    }
}

export interface MetaItemProps {
    className?: string,
    category: string,
    name: string,
    value: any,
    featureAlias: string[],
    onHover: () => void,
    onLeave: () => void,
    onPin?: () => void,
    layout: number[],
    entityCategoricalColor?: (entityName: string | undefined) => string,
}

export interface MetaItemStates {
    pinned: boolean,
}

export class MetaItem extends React.PureComponent<MetaItemProps, MetaItemStates> {
    constructor(props: MetaItemProps) {
        super(props);

        this.state = { pinned: false };
        this.pin = this.pin.bind(this);
    }

    private pin() {
        const { onPin } = this.props;
        this.setState({ pinned: !this.state.pinned });
        onPin && onPin();
    }

    public render() {
        const { category, name, value, featureAlias, layout, onHover, onLeave, className, entityCategoricalColor } = this.props;
        const { pinned } = this.state;
        let displayName = name.replace(/_/g, " ");
        if (!['CPB time (minutes)', 'ICD10 CODE CN'].includes(displayName)) {
            displayName = displayName.toLocaleLowerCase();
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }
        if (name === 'Aortic cross-clamping time (times)') {
            displayName = 'Aortic cross-clamping time (minutes)';
        }

        return <Row className={'meta-item'} id={`${className}-${name}`}
            style={{
                borderLeftWidth: featureAlias.includes(name) ? 4 : 0,
                borderLeftColor: entityCategoricalColor ? entityCategoricalColor(category) : defaultCategoricalColor(0)
            }}
            onMouseOver={onHover} onMouseOut={onLeave}>
            <Col span={layout[0]} />
            <Col span={layout[1]}>
                <span className="details-title"> {displayName}: </span>
            </Col>
            <Col span={layout[2]} />
            <Col span={layout[3]}>
                <div className={`value ${category}`} >{displayName === 'Diagnosis' ? 'CHD' : value}</div>
            </Col>
            <Col span={layout[4]}>
                {(featureAlias.includes(name)) && <Button size="small" type="primary"
                    shape="circle"
                    icon={<PushpinOutlined />} onClick={this.pin}
                    className={"pin"} style={{ display: pinned ? 'block' : undefined }}
                />}
            </Col>
        </Row>
    }
}