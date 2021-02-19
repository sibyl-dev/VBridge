import * as React from "react";
import Panel from "../Panel"


export interface TimelineViewProps {}

export interface TimelineViewStates {}

export default class TimelineView extends React.Component<TimelineViewProps, TimelineViewStates> {
    public render (){
        return (
            <Panel initialWidth={800} initialHeight={260} x={405} y={0}>

            </Panel>
        )
    }
}