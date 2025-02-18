import React, { MouseEventHandler, PropsWithChildren } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button, Container } from "@mui/material";

export const AppErrorBoundary: React.FC<PropsWithChildren> = ({ children }) => {
    const handleRefresh: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.preventDefault();
        window.location.reload();
    }

    return (
        <ErrorBoundary
            fallback={
                <Container>
                    <h1>Please refresh the page / Veuillez rafraîchir la page</h1>
                    <p>
                        We apologize for the inconvenience. Please try refreshing the page or come back later.
                        <br />
                        Nous nous excusons pour le désagrément. Veuillez essayer de rafraîchir la page ou revenir plus tard.
                    </p>
                    <Button variant="contained" onClick={handleRefresh}>
                        Refresh / Rafraîchir
                    </Button>

                </Container>
            }
        >
            {children}
        </ErrorBoundary>
    );
}
