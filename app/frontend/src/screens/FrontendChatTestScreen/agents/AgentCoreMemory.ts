import { isAgentAction, isAgentTurn, isUserAction, isUserTurn } from "./AgentCore.utils";
import { MemoryAccessError, MemoryValidationError } from "./AgentCoreErrors";
import { AgentAction, AgentTurn, TurnIndex, UserAction, UserTurn } from "./AgentCoreMemory.types";
import { ListenerManager } from "./listenermanager/ListenerManager";

export class AgentCoreMemory {
    private turns: (AgentTurn | UserTurn)[] = [];
    private listeners: ListenerManager<void> = new ListenerManager<void>();

    addUserTurn(): TurnIndex {
        const userTurn: UserTurn = {
            type: 'turn:user',
            actions: []
        };
        this.turns.push(userTurn);
        this.listeners.notifyListeners();
        return this.turns.length - 1;
    }

    addAgentTurn(): TurnIndex {
        const agentTurn: AgentTurn = {
            type: 'turn:agent',
            actions: []
        };
        this.turns.push(agentTurn);
        this.listeners.notifyListeners();
        return this.turns.length - 1;
    }

    addTurnAction(turnIndex: TurnIndex, action: AgentAction | UserAction): void {
        if (turnIndex < 0 || turnIndex >= this.turns.length) {
            // Turn index is out of bounds
            throw new MemoryAccessError(`Turn index ${turnIndex} is out of bounds.`);
        }

        const turn = this.turns[turnIndex];
        if (!turn) {
            // Turn does not exist at the specified index
            throw new MemoryAccessError(`No turn found at index ${turnIndex}.`);
        }
        
        if (isUserTurn(turn)) {
            if (!isUserAction(action)) {
                throw new MemoryValidationError('Tried to add non-UserAction to UserTurn. Object: ' + action);
            }
            turn.actions.push(action as UserAction);
            this.listeners.notifyListeners();
        } else if (isAgentTurn(turn)) {
            if (!isAgentAction(action)) {
                throw new MemoryValidationError('Tried to add non-AgentAction to AgentTurn. Object: ' + action);
            }
            turn.actions.push(action as AgentAction);
            this.listeners.notifyListeners();
        } else {
            throw new MemoryValidationError(`Turn at index ${turnIndex} is neither a UserTurn nor an AgentTurn. Corrupted memory?`);
        }
    }

    export(): (AgentTurn | UserTurn)[] {
        return JSON.parse(JSON.stringify(this.turns));
    }

    onUpdate(callback: () => void): void {
        this.listeners.addListener(callback);
    }
}