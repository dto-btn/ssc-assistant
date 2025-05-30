// illegal action class
export class AgentCoreError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentCoreError';
    }
}

export class AgentCoreMemoryError extends AgentCoreError {
    constructor(message: string) {
        super(message);
        this.name = 'AgentCoreMemoryError';
    }
}

export class MemoryValidationError extends AgentCoreMemoryError {
    constructor(message: string) {
        super(message);
        this.name = 'MemoryValidationError';
    }
}

export class MemoryAccessError extends AgentCoreMemoryError {
    constructor(message: string) {
        super(message);
        this.name = 'MemoryAccessError';
    }
}