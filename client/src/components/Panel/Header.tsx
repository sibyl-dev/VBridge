import * as React from 'react';

export interface IHeaderProps {
  title?: string
}

export default class Header extends React.Component<IHeaderProps> {
  public render() {
    return (
      <div className="panel-header">
        <span className="panel-title">{this.props.title}</span>
      </div>
    );
  }
}
