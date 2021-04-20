import { RingProgress } from '@ant-design/charts';
import * as React from "react";


export interface ringProgressProps {
    percentParent: number,
}

export interface ringProgressStates { 
    height: number,
    width: number,
    color: string [],
    autoFit: boolean,
    percent: number,
    fill: string,
}

// const DemoRingProgress: React.FC = () => {
//   var config = {
//     height: 100,
//     width: 100,
//     autoFit: false,
//     percent: 0.7,
//     color: ['#5B8FF9', '#E8EDF3'],
//   };
//   return <RingProgress {...config} />;
// };



export default class RingProgresself extends React.Component<ringProgressProps, ringProgressStates> {
    constructor(props: ringProgressProps) {
        super(props);
        this.state = {height:40, width:40,  color: ['#5B8FF9', '#E8EDF3'], autoFit: false, percent:0, fill: '#cccccc'}
       
    }
    public init() {
    	const percent = this.props.percentParent
    	this.setState({percent})
    }
    public componentDidMount() {
        this.init();
    }
    public render(){
    	let statistic = { style:{fontSize:'0px'}}
    	 return (<RingProgress {...this.state}  {...statistic}/>);
    	
    	
    }
}