import * as React from "react";
// import Moveable from "moveable";
import { Rnd } from "react-rnd";

import "./index.css";
import PanelHeader from "./Header";

export interface IPanelProps {
  initialWidth: number;
  initialHeight: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  title?: string;
  resizable?: boolean;
  draggable?: boolean;
}

export interface IPanelState {
  width: number;
  height: number;
  x: number;
  y: number;
  // translate: [number, number];
}

export default class Panel extends React.Component<IPanelProps, IPanelState> {
  static getDerivedStateFromProps(
    nextProps: IPanelProps,
    prevState: IPanelState
  ) {
    const newState: Partial<IPanelState> = {};
    let flag = false;
    if (nextProps.x && nextProps.x !== prevState.x) {
      newState.x = nextProps.x;
      flag = true;
    }
    if (nextProps.width && nextProps.width !== prevState.width) {
      newState.width = nextProps.width;
      flag = true;
    }
    if (nextProps.y && nextProps.y !== prevState.y) {
      newState.y = nextProps.y;
      flag = true;
    }
    if (nextProps.height && nextProps.height !== prevState.height) {
      newState.height = nextProps.height;
      flag = true;
    }
    if (flag) return newState;
    return null;
  }

  static defaultProps = {
    initialWidth: 800,
    initialHeight: 600
  };

  private ref: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: IPanelProps) {
    super(props);

    this.state = {
      width: props.initialWidth,
      height: props.initialHeight,
      x: props.x || 0,
      y: props.y || 0
    };
  }

  public render() {
    const { title } = this.props;
    const { x, y, width, height } = this.state;
    return (
      <Rnd
        className="panel-wrapper"
        default={{
          x: 150,
          y: 205,
          width: 500,
          height: 190
        }}
        size={{ width, height }}
        position={{ x, y }}
        minWidth={100}
        minHeight={190}
        bounds="window"
        disableDragging={false}
        onDragStop={(e, d) => {
          this.setState({ x: d.x, y: d.y });
        }}
        onResize={(e, direction, ref, delta, position) => {
          this.setState({
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            ...position
          });
        }}
        cancel=".panel-body"
        style={{ cursor: "inherit" }}
      >
        <PanelHeader title={title} />
        <PanelBody>{this.props.children}</PanelBody>
      </Rnd>
      // <div className="panel-wrapper" ref={this.ref} style={{width, height, transform}}>
      //   {this.props.children}
      // </div>
    );
  }
}

interface IPanelContentProps {
  children?: React.ReactNode;
}

function PanelBody(props: IPanelContentProps) {
  return <div className="panel-body">{props.children}</div>;
}
