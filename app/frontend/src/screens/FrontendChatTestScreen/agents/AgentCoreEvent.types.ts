// Base type for all agent events
export interface AgentCoreEventBase {
  type: string;
}

// Log level type for debug-log events
export type LogLevel = 'error' | 'info' | 'debug';

// Finish reason types for the finished event
export type FinishReason = 'stop' | 'iterationLimitReached' | 'error';

// Status types for the turn connection
export type TurnConnectionStatus = 'active' | 'finished' | 'stopping';

// Event: Agent started processing a query
export interface StartedEvent extends AgentCoreEventBase {
  type: 'started';
}

// Event: Agent finished processing
export interface FinishedEvent extends AgentCoreEventBase {
  type: 'finished';
  data: {
    finishReason: FinishReason;
  };
}

// Event: Agent encountered an error
export interface ErrorEvent extends AgentCoreEventBase {
  type: 'error';
  data: {
    content: string;
  };
}

// Event: Debug log information
export interface DebugLogEvent extends AgentCoreEventBase {
  type: 'debug-log';
  data: {
    logLevel: LogLevel;
    logContent: string;
  };
}

/**
 * This event is used to update the streaming message content as it is being generated.
 * It is emitted multiple times during the streaming process to provide real-time updates.
 */
export interface StreamingMessageUpdateEvent extends AgentCoreEventBase {
  type: 'streaming-message-update';
  data: {
    content: string;
  };
}

// Union type of all possible agent events
export type AgentCoreEvent = 
  | StartedEvent
  | FinishedEvent
  | ErrorEvent
  | DebugLogEvent
  | StreamingMessageUpdateEvent;
