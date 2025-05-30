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

// Event: Agent responded with a plaintext message
export interface MessageEvent extends AgentCoreEventBase {
  type: 'message';
  data: {
    content: string;
  };
}

// Event: Agent started a streaming message
export interface MessageStreamStartEvent extends AgentCoreEventBase {
  type: 'message-stream-start';
}

// Event: Chunk of a streaming message received
export interface MessageStreamChunkEvent extends AgentCoreEventBase {
  type: 'message-stream-chunk';
  data: {
    content: string;
  };
}

// Event: Streaming message completed
export interface MessageStreamFinishEvent extends AgentCoreEventBase {
  type: 'message-stream-finish';
  data: {
    success: boolean;
  };
}

// Event: Agent thought
export interface ThoughtEvent extends AgentCoreEventBase {
  type: 'thought';
  data: {
    content: string;
  };
}

// Event: Agent observation
export interface ObservationEvent extends AgentCoreEventBase {
  type: 'observation';
  data: {
    content: string;
  };
}

// Event: Agent started using a tool
export interface ToolStartEvent extends AgentCoreEventBase {
  type: 'tool-start';
  data: {
    toolName: string;
    toolId: string;
    parameters: Record<string, any>;
    invocationId: string;
  };
}

// Event: Tool execution finished successfully
export interface ToolFinishEvent extends AgentCoreEventBase {
  type: 'tool-finish';
  data: {
    toolName: string;
    toolId: string;
    invocationId: string;
  };
}

// Event: Tool execution had an error
export interface ToolErrorEvent extends AgentCoreEventBase {
  type: 'tool-error';
  data: {
    toolName: string;
    toolId: string;
    invocationId: string;
  };
}

// Event: Agent finished processing
export interface FinishedEvent extends AgentCoreEventBase {
  type: 'finished';
  data: {
    finishReason: FinishReason;
    content?: string; // Optional, present when finishReason is 'error'
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
  | MessageEvent
  | MessageStreamStartEvent
  | MessageStreamChunkEvent
  | MessageStreamFinishEvent
  | ThoughtEvent
  | ObservationEvent
  | ToolStartEvent
  | ToolFinishEvent
  | ToolErrorEvent
  | FinishedEvent
  | ErrorEvent
  | DebugLogEvent;

// TurnConnection interface for handling the agent turn
export interface TurnConnection {
  getEvents: () => AgentCoreEvent[];
  getStatus: () => TurnConnectionStatus;
  stop: () => void;
}