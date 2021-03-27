import * as React from 'react';

export interface IHeaderProps {
  title?: string | React.ReactNode
}

export default class Header extends React.Component<IHeaderProps> {
  public render() {
    return (
      <div className="panel-header" style={{ backgroundColor: '#97c4d0' }}>
        <span className="panel-title">{this.props.title}</span>

      </div>
    );
  }
}
