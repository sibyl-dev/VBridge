import * as React from "react";
import Panel from "../Panel"


export interface MetaViewProps {}

export interface MetaViewStates {}

export default class MetaView extends React.Component<MetaViewProps, MetaViewStates> {
    public render (){
        return (
            <Panel initialWidth={400} initialHeight={260} x={1210} y={0}>

            </Panel>
        )
    }
}