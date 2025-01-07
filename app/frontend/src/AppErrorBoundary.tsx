import React, { MouseEventHandler, PropsWithChildren } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const AppErrorBoundary: React.FC<PropsWithChildren> = ({ children }) => {
    const handleRefresh: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.preventDefault();
        window.location.reload();
    }

    return (
        <ErrorBoundary
            fallback={<div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
                <h1>Something went wrong / Quelque chose a mal tourné</h1>
                <p>
                    We apologize for the inconvenience. Please try refreshing the page or come back later.
                    <br />
                    Nous nous excusons pour le désagrément. Veuillez essayer de rafraîchir la page ou revenir plus tard.
                </p>
                <button onClick={handleRefresh} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Refresh / Rafraîchir
                </button>

            </div>
            }
        >
            {children}
        </ErrorBoundary>
    );
}
