// filepath: /home/monarch/workspace/ssc-assistant/app/frontend/src/screens/FrontendChatTestScreen/agents/AgentCoreEvent.ts

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

// Union type of all possible agent events
export type AgentCoreEvent = 
  | StartedEvent
  | FinishedEvent
  | ErrorEvent
  | DebugLogEvent;
