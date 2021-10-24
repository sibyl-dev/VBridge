import * as React from "react";
// import Moveable from "moveable";
import { Rnd } from "react-rnd";

import "./index.css";
import PanelHeader, { IHeaderProps } from "./Header";
import { IMargin } from "visualization/common";

export interface IPanelProps extends IHeaderProps {
  initialWidth: number;
  initialHeight: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  margin?: IMargin;
  resizable?: boolean;
  draggable?: boolean;
  id?: string;
  disableDragging?: boolean;
}

export interface IPanelState {
  width: number;
  height: number;
  x: number;
  y: number;
  // translate: [number, number];
}

const defaultMargin = {
  top: 5,
  bottom: 5,
  left: 5,
  right: 5
}

export default class Panel extends React.Component<IPanelProps, IPanelState> {

  static defaultProps = {
    initialWidth: 800,
    initialHeight: 600
  };

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
    const { title, widgets, id, disableDragging } = this.props;
    const margin = { ...defaultMargin, ...this.props.margin };
    const x = this.state.x + margin.left;
    const y = this.state.y + margin.top;
    const width = this.state.width - margin.left - margin.right;
    const height = this.state.height - margin.top - margin.bottom;
    return (
      <Rnd
        className="panel-wrapper"
        id={id}
        size={{ width, height }}
        position={{ x, y }}
        minWidth={100}
        minHeight={190}
        bounds="window"
        disableDragging={disableDragging === undefined ? true : disableDragging} // Set it as false to enable dragging
        onDragStop={(e, d) => {
          this.setState({ x: d.x, y: d.y });
        }}
        onResize={(e, direction, ref, delta, position) => {
          console.log(position);
          this.setState({
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            ...position
          });
        }}
        cancel=".panel-body"
        style={{ cursor: "inherit" }}
      >
        <PanelHeader title={title} widgets={widgets} />
        <PanelBody>{this.props.children}</PanelBody>
      </Rnd>
    );
  }
}

interface IPanelContentProps {
  children?: React.ReactNode;
}

function PanelBody(props: IPanelContentProps) {
  return <div className="panel-body">{props.children}</div>;
}
