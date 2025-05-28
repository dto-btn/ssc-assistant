import { Listener } from "./ListenerManager.types";

export class ListenerManager<DataType> {
    private listeners: (Listener<DataType>)[] = [];

    // Add a listener to the manager
    addListener(listener: Listener<DataType>): void {
        this.listeners.push(listener);
    }

    // Remove a listener from the manager
    removeListener(listener: Listener<DataType>): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    // Notify all listeners with the provided data
    notifyListeners(data: DataType): void {
        for (const listener of this.listeners) {
            listener(data);
        }
    }
}