export interface UserTurn {
    type: 'turn:user';
    actions: UserAction[]
}

export interface AgentTurn {
    // this object contains the agent's entire turn, including all responses and events.
    type: 'turn:agent';
    actions: AgentAction[];
}

export interface AgentMessage {
    type: 'action:agent-message';
    content: string;
}

export interface AgentThought {
    type: 'action:agent-thought';
    content: string;
}

export interface AgentObservation {
    type: 'action:agent-observation';
    content: string;
}

export interface AgentToolCall {
    type: 'action:agent-tool-call';
    toolCallId: string;
    toolName: string;
    toolArguments: string;
}

export interface AgentToolCallResponse {
    type: 'action:agent-tool-call-response';
    toolCallId: string;
    toolName: string;
    toolResponse: string;
}

export interface AgentError {
    type: 'action:agent-error';
    content: string;
}

export interface AgentDebugLog {
    type: 'action:agent-debug-log';
    content: string;
    level: 'error' | 'info' | 'debug';
}

export type UserAction = {
            type: 'action:user-message';
            content: string;
        };

export type AgentAction = 
    | AgentMessage
    | AgentThought
    | AgentObservation
    | AgentToolCall
    | AgentToolCallResponse
    | AgentError
    | AgentDebugLog
    | UserTurn
    | AgentTurn;

export type TurnIndex = number;

export type UpdateEventTurnAdded = {
    type: 'turn-added',
    category: 'user' | 'agent',
    turnIndex: TurnIndex;
}

export type UpdateEventActionAdded = {
    type: 'action-added',
    turnIndex: TurnIndex;
    action: UserAction | AgentAction,
}

/**
 * The StreamingMessageUpdate does not represent a complete action, but rather an update to an ongoing message.
 * It is used to stream updates to the UI as the agent generates a message.
 */
export type StreamingMessageUpdate = {
    type: 'streaming:agent-message-update',
    content: string;
}

export type UpdateEvent = UpdateEventTurnAdded | UpdateEventActionAdded | StreamingMessageUpdate;

/**
 * Callback type for when an action is added to the memory.
 * This callback is called whenever a new action is added to the memory.
 * It receives an `UpdateEvent` which contains information about the action added.
 * This allows components to react to changes in the memory, such as re-rendering or updating the UI.
 * @param event - The event containing information about the action added.
 * 
 */
export type OnUpdateCallback = (event: UpdateEvent) => void;