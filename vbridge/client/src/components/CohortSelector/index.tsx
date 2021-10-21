import * as React from "react";
import { Button, Checkbox, Divider } from "antd"

import "./index.scss"
import { isCategoricalVariable, SelectorVariable } from "type/resource/task";

export interface CohortSelectorProps {
    className?: string,
    selectorVars: SelectorVariable[],
    updateExtent?: (selectorVarExtent: SelectorVariable[]) => void
}

export interface CohortSelectorState {
    selectorVarExtent: SelectorVariable[],
}

export default class CohortSelector extends React.PureComponent<CohortSelectorProps, CohortSelectorState> {
    private globalKey: number = 0
    constructor(props: CohortSelectorProps) {
        super(props);

        this.state = { selectorVarExtent: [...props.selectorVars] };

        this._updateExtent = this._updateExtent.bind(this);
        this._resetExtent = this._resetExtent.bind(this);
        this._submitExtent = this._submitExtent.bind(this);
    }

    protected _updateExtent(index: number, newExtent: SelectorVariable) {
        const { selectorVarExtent } = this.state;
        selectorVarExtent[index] = newExtent;
        this.setState({ selectorVarExtent });
    }

    protected _resetExtent() {
        this.globalKey += 1;
        this.setState({ selectorVarExtent: [...this.props.selectorVars] });
    }

    protected _submitExtent() {
        const { updateExtent } = this.props;
        updateExtent && updateExtent(this.state.selectorVarExtent);
    }

    render() {
        const { className, selectorVars } = this.props;
        const { selectorVarExtent } = this.state;

        return <div className={`${className || ''} cohort-selector`}>
            {selectorVars.map((d, i) => {
                return <SelectorWidget
                    key={`${this.globalKey}-${i}`}
                    selectorVar={d}
                    extent={selectorVarExtent[i]}
                    updateExtent={this._updateExtent.bind(this, i)}
                />
            })}
            <div className="selector-button-group">
                <Button className="selector-button" onClick={this._resetExtent}>Reset</Button>
                <Button type="primary" className="selector-button" onClick={this._submitExtent}>Submit</Button>
            </div>
        </div>
    }

}

const { Group } = Checkbox;

export interface SelectorWidgetProps {
    className?: string,
    selectorVar: SelectorVariable,
    extent: SelectorVariable,
    updateExtent: (selectorVarExtent: SelectorVariable) => void
}

export class SelectorWidget extends React.PureComponent<SelectorWidgetProps> {
    constructor(props: SelectorWidgetProps) {
        super(props);
    }

    render() {
        const { className, selectorVar, extent, updateExtent } = this.props;

        return <div className={`${className || ''} selector-widget`}>
            <h3 className="widget-title">{selectorVar.name}</h3>
            <Divider />
            {isCategoricalVariable(selectorVar) && <Group
                options={selectorVar.extent}
                defaultValue={extent.extent}
                onChange={value => updateExtent({...selectorVar, extent: value as string[]})}
            />}
            <Divider />
        </div>
    }
}
