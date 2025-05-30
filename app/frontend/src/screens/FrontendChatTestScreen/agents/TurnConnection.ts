import { AgentCoreEvent, TurnConnectionStatus } from "./AgentCoreEvent.types";
import { ListenerManager } from "./listenermanager/ListenerManager";
import { Listener } from "./listenermanager/ListenerManager.types";

export class TurnConnection {
    private eventListeners: ListenerManager<AgentCoreEvent> = new ListenerManager<AgentCoreEvent>();
    private status: TurnConnectionStatus = 'active'; // Default status, can be updated based on actual connection state
    private events: AgentCoreEvent[] = [];

    /**
     * Register a listener for new events.
     * The listener will be called with event data during the agent's turn.
     * @param listener 
     */
    onEvent(listener: Listener<AgentCoreEvent>) {
        this.eventListeners.addListener(listener);
    }

    /**
     * Trigger an event.
     * This will call all registered listeners with the event data.
     * @param evt The event data to pass to the listeners
     */
    triggerEvent(evt: AgentCoreEvent) {
        this.eventListeners.notifyListeners(evt);
    }

    getEvents(): AgentCoreEvent[] {
        return JSON.parse(JSON.stringify(this.events)); // Return a deep copy of the events
    }

    getStatus(): TurnConnectionStatus {
        return this.status;
    }

    setStatus(status: TurnConnectionStatus) {
        this.status = status;
    }
}
