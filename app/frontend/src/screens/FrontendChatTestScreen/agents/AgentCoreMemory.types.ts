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
    | AgentError
    | AgentDebugLog
    | UserTurn
    | AgentTurn;

export type TurnIndex = number;