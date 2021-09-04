import * as React from 'react';

export interface IHeaderProps {
  title?: string,
  widgets?: {name?: string, content: React.ReactNode}[]
}

export default class Header extends React.Component<IHeaderProps> {
  public render() {
    const { title, widgets } = this.props;
    return (
      <div className="panel-header">
        <span className="panel-title">
          <div className="view-title">
            <span className="view-title-text">{title}</span>
            <div className="widget">
              {widgets?.map(w =>
              (<div className="widget-item">
                <span className="widget-text">{w.name}</span>
                {w.content}
              </div>))}
            </div>
          </div>
        </span>

      </div>
    );
  }
}
