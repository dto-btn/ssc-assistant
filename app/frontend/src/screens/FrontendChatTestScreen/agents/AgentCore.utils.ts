import { AgentAction, AgentTurn, UserAction, UserTurn } from "./AgentCoreMemory.types";

export const isAgentAction = (obj: any): obj is AgentAction => {
    return obj && typeof obj === 'object' && typeof obj.type === 'string' && obj.type.startsWith('action:agent-');
}

export const isUserAction = (obj: any): obj is UserAction => {
    return obj && typeof obj === 'object' && typeof obj.type === 'string' && obj.type.startsWith('action:user-');
}

export const isAgentTurn = (obj: any): obj is AgentTurn => {
    return obj && typeof obj === 'object' && obj.type === 'turn:agent';
}

export const isUserTurn = (obj: any): obj is UserTurn => {
    return obj && typeof obj === 'object' && obj.type === 'turn:user';
}