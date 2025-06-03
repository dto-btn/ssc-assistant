import { AgentCoreLlmClientConnectionEvent } from "./AgentCoreLlmClientConnection.types";
import { ListenerManager } from "./listenermanager/ListenerManager";

export class AgentCoreLlmClientConnection {
    private listeners: ListenerManager<AgentCoreLlmClientConnectionEvent> = new ListenerManager();

    private closed: boolean = false;
    private error: unknown | null = null;

    /**
     * Register a listener for connection events.
     * The listener will be called with event data during the connection lifecycle.
     * @param listener 
     */
    onEvent(listener: (event: AgentCoreLlmClientConnectionEvent) => void) {
        this.listeners.addListener(listener);
    }

    /**
     * Trigger an event.
     * This will call all registered listeners with the event data.
     * @param evt The event data to pass to the listeners
     */
    triggerEvent(evt: AgentCoreLlmClientConnectionEvent) {
        if (this.closed) {
            console.warn("Connection is closed, cannot trigger event:", evt);
            return;
        }
        this.listeners.notifyListeners(evt);
    }

    /**
     * Close the connection with an optional error.
     * This will trigger a close event to all listeners.
     * @param error Optional error to close the connection with
     */
    close(error?: unknown) {
        if (this.closed) {
            console.warn("Connection is already closed");
            return;
        }
        this.closed = true;
        this.error = error || null;

        const closeEvent: AgentCoreLlmClientConnectionEvent.Close = {
            type: 'close',
            data: this.error ? { ok: false, error: this.error } : { ok: true }
        };

        this.triggerEvent(closeEvent);
    }
}
