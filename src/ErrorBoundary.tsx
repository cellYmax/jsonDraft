import React from "react";

type ErrorBoundaryState = {
  message: string | null;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    message: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="app-error">
          <h1>jsonDraft 启动失败</h1>
          <p>{this.state.message}</p>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
