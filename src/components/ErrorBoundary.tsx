import { Component, type ReactNode } from 'react';

/** Keeps one bad render (e.g. a malformed AI reply) from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="callout warn" role="alert">
        <div className="grow">
          <p className="headline" style={{ margin: 0 }}>This screen couldn’t be shown</p>
          <p className="subhead secondary">{this.state.error.message}</p>
          <button type="button" className="btn tinted small" style={{ marginTop: 8 }} onClick={() => { this.props.onReset(); this.setState({ error: null }); }}>
            Clear AI output on this screen
          </button>
        </div>
      </div>
    );
  }
}
