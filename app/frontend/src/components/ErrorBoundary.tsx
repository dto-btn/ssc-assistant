import React, { PropsWithChildren, ErrorInfo } from "react";

type ErrorBoundaryProps = PropsWithChildren<{
    fallback: React.ReactNode;
}>;

type ErrorBoundaryState = {
    hasError: boolean;
}

// The latest boundary docs are sometimes a little hard to find. Here's the link to the official React docs:
// https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export class ErrorBoundary<P extends ErrorBoundaryProps> extends React.Component<P> {
    state: ErrorBoundaryState;

    constructor(props: P) {
        super(props);
        this.state = { hasError: true };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // we can add logging to an external service here
        console.error("Uncaught error:", error, errorInfo);
    }

    handleRefresh = () => {
        window.location.reload();
    };


    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback
            );


        }

        return this.props.children;
    }
}