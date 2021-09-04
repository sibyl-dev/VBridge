import * as React from "react";
import { Row, Col, Divider, Button } from "antd"
import { defaultCategoricalColor } from "visualization/common";
import { FeatureSchema, PatientStatics } from "type/resource";
import { PushpinOutlined } from "@ant-design/icons";

import "./index.scss"

export interface MetaViewProps {
    className?: string,
    patientStatics?: PatientStatics,
    featureSchema: FeatureSchema[],
    updateFocusedFeatures?: (featureNames: string[]) => void,
    updatePinnedFocusedFeatures?: (featureNames: string[]) => void,
    entityCategoricalColor?: (entityName: string | undefined) => string,
}

export interface MetaViewStates { }

export default class MetaView extends React.PureComponent<MetaViewProps, MetaViewStates> {

    constructor(props: MetaViewProps) {
        super(props);
        this.onHover = this.onHover.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.onPin = this.onPin.bind(this);
    }

    private onHover(name: string) {
        const { updateFocusedFeatures, featureSchema: featureMeta } = this.props;
        const targetFeature = featureMeta.find(row => row.alias === name);
        if (targetFeature)
            updateFocusedFeatures && updateFocusedFeatures([targetFeature.id]);
    }

    private onLeave() {
        const { updateFocusedFeatures } = this.props;
        updateFocusedFeatures && updateFocusedFeatures([]);
    }

    private onPin(name: string) {
        const { updatePinnedFocusedFeatures, featureSchema: featureMeta } = this.props;
        const targetFeature = featureMeta.find(row => row.alias === name);
        if (targetFeature)
            updatePinnedFocusedFeatures && updatePinnedFocusedFeatures([targetFeature.id]);
    }

    public render() {
        const { patientStatics, featureSchema, className, entityCategoricalColor } = this.props;
        const featureAlias = featureSchema.map(f => f.alias);
        return (
            <div className={"meta-view"}>
                {patientStatics && patientStatics.map(items => <div key={items.entityId}>
                    <Divider orientation="center" style={{ margin: 6 }}> {items.entityId} </Divider>
                    {Object.keys(items.items).map(name => {
                        let value = items.items[name];
                        if (name.indexOf("TIME") != -1) {
                            value = value.substr(11, 8);
                        }

                        return <MetaItem
                            className={className}
                            category={items.entityId}
                            name={name}
                            key={name}
                            value={value}
                            featureAlias={featureAlias}
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
        const { category, name, value, featureAlias, onHover, onLeave, className, entityCategoricalColor } = this.props;
        const { pinned } = this.state;
        let displayName = name.replace(/_/g, " ");

        return <Row className={'meta-item'} id={`${className}-${name}`}
            style={{
                borderLeftWidth: featureAlias.includes(name) ? 4 : 0,
                borderLeftColor: entityCategoricalColor ? entityCategoricalColor(category) : defaultCategoricalColor(0)
            }}
            onMouseOver={onHover} onMouseOut={onLeave}>
            <Col span={1} />
            <Col span={10}>
                <span className="details-title"> {displayName}: </span>
            </Col>
            <Col span={1} />
            <Col span={11}>
                <div className={`value`} >{displayName === 'Diagnosis' ? 'CHD' : value}</div>
            </Col>
            <Col span={1}>
                {(featureAlias.includes(name)) && <Button size="small" type="primary"
                    shape="circle"
                    icon={<PushpinOutlined />} onClick={this.pin}
                    className={"pin"} style={{ display: pinned ? 'block' : undefined }}
                />}
            </Col>
        </Row>
    }
}