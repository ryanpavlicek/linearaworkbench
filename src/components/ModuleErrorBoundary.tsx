import { Component, type ReactNode } from "react";

// Error boundaries are the one thing React still requires a class component
// for — the single deliberate exception to the hooks-only rule. Contains a
// module render crash to the module pane: the chrome (sidebar, top bar) and
// all persisted research data stay alive, and the researcher can retry the
// module or just switch to another one.
interface Props {
  // Changing this (the active module id) discards a previous failure, so
  // navigating away from a crashed module always works.
  resetKey: string;
  children: ReactNode;
}

interface ErrState {
  error: Error | null;
  lastKey: string;
}

export class ModuleErrorBoundary extends Component<Props, ErrState> {
  state: ErrState = { error: null, lastKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: Props,
    state: ErrState,
  ): Partial<ErrState> | null {
    if (props.resetKey !== state.lastKey) {
      return { error: null, lastKey: props.resetKey };
    }
    return null;
  }

  render() {
    if (this.state.error) {
      return (
        <div className="loader" role="alert">
          <span>
            This module hit an error: {this.state.error.message || "unknown"}.
            Your data is safe — annotations, findings, and notes live outside
            the module.
          </span>
          <button onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
