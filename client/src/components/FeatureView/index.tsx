import * as React from "react";
import Panel from "../Panel"


export interface FeatureViewProps {}

export interface FeatureViewStates {}

export default class FeatureView extends React.Component<FeatureViewProps, FeatureViewStates> {
    public render (){
        return (
            <Panel initialWidth={400} initialHeight={700} x={0} y={0}>

            </Panel>
        )
    }
}