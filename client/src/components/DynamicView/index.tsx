import * as React from "react";
import Panel from "../Panel"


export interface DynamicViewProps {}

export interface DynamicViewStates {}

export default class DynamicView extends React.Component<DynamicViewProps, DynamicViewStates> {
    public render (){
        return (
            <Panel initialWidth={600} initialHeight={435} x={405} y={265}>

            </Panel>
        )
    }
}