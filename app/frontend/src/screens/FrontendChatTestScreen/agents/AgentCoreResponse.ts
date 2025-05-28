import { ListenerManager } from "./ListenerManager";
import { Listener } from "./ListenerManager.types";

export interface AgentProgressData {
    currentIteration: number;
    maxIterations: number;
    hasThought: boolean;
    hasObserved: boolean;
    reasoningSteps: number;
    uniqueToolCalls: Set<string>;
    lastAction?: string;
}

export class AgentCoreConnection {
    private errorListeners: ListenerManager<unknown> = new ListenerManager<unknown>();
    private completeListeners: ListenerManager<void> = new ListenerManager<void>();
    private responseText: string = '';
    private progressListeners: ListenerManager<AgentProgressData> = new ListenerManager<AgentProgressData>();

    constructor() {}

    /**
     * Register a listener for error events.
     * The listener will be called with the error data when an error occurs.
     * @param listener 
     */
    onError(listener: Listener<unknown>) {
        this.errorListeners.addListener(listener);
    }

    /**
     * Register a listener for completion events.
     * The listener will be called when the agent core processing is complete.
     * @param listener 
     */
    onComplete(listener: Listener<void>) {
        this.completeListeners.addListener(listener);
    }

    /**
     * Register a listener for progress events.
     * The listener will be called with progress data during the agent's reasoning process.
     * @param listener 
     */
    onProgress(listener: Listener<AgentProgressData>) {
        this.progressListeners.addListener(listener);
    }

    /**
     * Trigger an error event.
     * This will call all registered error listeners with the error data.
     * @param error The error data to pass to the listeners
     */
    triggerError(error: unknown) {
        this.errorListeners.notifyListeners(error);
    }

    /**
     * Trigger a completion event.
     * This will call all registered completion listeners.
     */
    triggerComplete() {
        this.completeListeners.notifyListeners();
    }

    /**
     * Trigger a progress event.
     * This will call all registered progress listeners with the progress data.
     * @param progressData The progress data to pass to the listeners
     */
    triggerProgress(progressData: AgentProgressData) {
        this.progressListeners.notifyListeners(progressData);
    }

    /**
     * Set the final response text.
     * @param text The response text to set
     */
    setResponseText(text: string) {
        this.responseText = text;
    }

    /**
     * Get the final response text.
     * @returns The response text
     */
    getResponseText(): string {
        return this.responseText;
    }
}
