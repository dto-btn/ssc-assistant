import React, { PropsWithChildren, ErrorInfo } from "react";

type ErrorBoundaryProps = PropsWithChildren<{
    fallback: React.ReactNode;
    forceShow?: boolean; // mainly for development purposes
}>;

type ErrorBoundaryState = {
    hasError: boolean;
}

// The latest boundary docs are sometimes a little hard to find. Here's the link to the official React docs:
// https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
export class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
    state: ErrorBoundaryState;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
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
        if (this.state.hasError || this.props.forceShow) {
            return (
                this.props.fallback
            );


        }

        return this.props.children;
    }
}