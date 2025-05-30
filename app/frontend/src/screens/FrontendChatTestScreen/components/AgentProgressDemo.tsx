import React, { useState } from 'react';
import { AgentProgressData } from "../agents/AgentCoreConnection.types";
import { useAgentCore } from '../hooks/useAgentCore';

/**
 * Demo component that shows how to use the progress listener with AgentCore
 */
export const AgentProgressDemo: React.FC = () => {
    const [query, setQuery] = useState<string>('Explain quantum computing in simple terms');
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [finalResponse, setFinalResponse] = useState<string | null>(null);
    const [progress, setProgress] = useState<AgentProgressData | null>(null);
    const [reasoningLog, setReasoningLog] = useState<Array<{
        type: string,
        content: string,
        details?: string,
        timestamp: string,
        expanded: boolean
    }>>([]);

    const agentCore = useAgentCore();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isBusy) return;

        setIsBusy(true);
        setFinalResponse(null);
        setProgress(null);
        setReasoningLog([]);

        const cnx = agentCore.processQuery(query);

        // Set up the progress listener
        cnx.onEvent((progressData) => {
            // Update the progress state
            setProgress({ ...progressData });

            // Log reasoning steps based on the lastAction
            if (progressData.lastAction) {
                const actionType = progressData.lastAction;
                const timestamp = new Date().toLocaleTimeString();

                // Add to the reasoning log
                if (actionType === 'think') {
                    setReasoningLog(prev => [...prev, {
                        type: 'thinking',
                        content: `Thinking (Step ${progressData.reasoningSteps})...`,
                        details: progressData.lastActionContent,
                        timestamp,
                        expanded: false
                    }]);
                } else if (actionType === 'observe') {
                    setReasoningLog(prev => [...prev, {
                        type: 'observation',
                        content: `Observation made.`,
                        details: progressData.lastActionContent,
                        timestamp,
                        expanded: false
                    }]);
                } else if (actionType === 'completed') {
                    setReasoningLog(prev => [...prev, {
                        type: 'completion',
                        content: 'Finished reasoning and found an answer.',
                        timestamp,
                        expanded: false
                    }]);
                } else if (actionType === 'max_iterations_reached') {
                    setReasoningLog(prev => [...prev, {
                        type: 'warning',
                        content: 'Maximum iterations reached. Extracting best possible answer.',
                        timestamp,
                        expanded: false
                    }]);
                } else if (actionType === 'error') {
                    setReasoningLog(prev => [...prev, {
                        type: 'error',
                        content: 'An error occurred during processing.',
                        timestamp,
                        expanded: false
                    }]);
                }
            }
        });

        // Set up completion listener
        cnx.onComplete(() => {
            setFinalResponse(cnx.getResponseText());
            setIsBusy(false);
        });

        // Set up error listener
        cnx.onError((error) => {
            console.error('Error in AgentCore:', error);
            setFinalResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsBusy(false);
        });
    };

    // Function to toggle step expansion
    const toggleStepExpansion = (index: number) => {
        setReasoningLog(prev => {
            const newLog = [...prev];
            newLog[index].expanded = !newLog[index].expanded;
            return newLog;
        });
    };

    // Calculate progress percentage
    const progressPercentage = progress
        ? Math.min(100, Math.round((progress.currentIteration / progress.maxIterations) * 100))
        : 0;

    return (
        <div className="agent-progress-demo">
            <h2>Agent Progress Demo</h2>

            {/* Query Input Form */}
            <form onSubmit={handleSubmit} className="query-form">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your query..."
                    disabled={isBusy}
                    className="query-input"
                />
                <button
                    type="submit"
                    disabled={isBusy || !query.trim()}
                    className="submit-button"
                >
                    {isBusy ? 'Processing...' : 'Submit'}
                </button>
            </form>

            {/* Progress Indicator */}
            {isBusy && progress && (
                <div className="progress-container">
                    <h3>Processing Query</h3>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    <div className="progress-stats">
                        <span>Iteration: {progress.currentIteration}/{progress.maxIterations}</span>
                        <span>Reasoning Steps: {progress.reasoningSteps}</span>
                    </div>

                    {/* Progress Tags */}
                    <div className="progress-tags">
                        <span className={`tag ${progress.hasThought ? 'active' : ''}`}>
                            Thought
                        </span>
                        <span className={`tag ${progress.hasObserved ? 'active' : ''}`}>
                            Observation
                        </span>
                    </div>
                </div>
            )}

            {/* Reasoning Log */}
            {reasoningLog.length > 0 && (
                <div className="reasoning-log">
                    <h3>Reasoning Process</h3>
                    <div className="log-entries">
                        {reasoningLog.map((entry, index) => (
                            <div key={index} className={`log-entry ${entry.type}`}>
                                <div
                                    className="log-entry-header"
                                    onClick={() => toggleStepExpansion(index)}
                                    style={{ cursor: entry.details ? 'pointer' : 'default' }}
                                >
                                    <div className="log-entry-main">
                                        {entry.details && (
                                            <span className="expand-icon">
                                                {entry.expanded ? '▼' : '►'}
                                            </span>
                                        )}
                                        <span className="log-timestamp">
                                            {entry.timestamp}
                                        </span>
                                        <span className="log-content">
                                            {entry.content}
                                        </span>
                                    </div>
                                </div>

                                {entry.expanded && entry.details && (
                                    <div className="log-entry-details">
                                        <pre>{entry.details}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Final Response */}
            {finalResponse && (
                <div className="final-response">
                    <h3>Final Response</h3>
                    <div className="response-content">
                        {finalResponse}
                    </div>
                </div>
            )}

            {/* CSS Styles */}
            <style>{`
                .agent-progress-demo {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .query-form {
                    display: flex;
                    margin-bottom: 20px;
                }
                
                .query-input {
                    flex: 1;
                    padding: 10px;
                    font-size: 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px 0 0 4px;
                }
                
                .submit-button {
                    padding: 10px 20px;
                    background-color: #0078d4;
                    color: white;
                    border: none;
                    border-radius: 0 4px 4px 0;
                    cursor: pointer;
                }
                
                .submit-button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                
                .progress-container {
                    margin-bottom: 20px;
                    padding: 15px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #f9f9f9;
                }
                
                .progress-bar-container {
                    height: 20px;
                    background-color: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                
                .progress-bar-fill {
                    height: 100%;
                    background-color: #0078d4;
                    transition: width 0.3s ease;
                }
                
                .progress-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                    color: #666;
                }
                
                .progress-tags {
                    display: flex;
                    margin-top: 10px;
                    gap: 10px;
                }
                
                .tag {
                    padding: 5px 10px;
                    border-radius: 20px;
                    background-color: #e0e0e0;
                    color: #666;
                    font-size: 12px;
                }
                
                .tag.active {
                    background-color: #0078d4;
                    color: white;
                }
                
                .reasoning-log {
                    margin-bottom: 20px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .log-entries {
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .log-entry {
                    margin-bottom: 8px;
                    border-radius: 4px;
                    font-size: 14px;
                    border: 1px solid rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                
                .log-entry-header {
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background-color: rgba(0,0,0,0.03);
                }
                
                .log-entry-main {
                    display: flex;
                    align-items: center;
                    flex: 1;
                }
                
                .expand-icon {
                    margin-right: 8px;
                    font-size: 10px;
                    color: #666;
                }
                
                .log-entry-details {
                    padding: 10px;
                    background-color: #fff;
                    border-top: 1px solid rgba(0,0,0,0.05);
                }
                
                .log-entry-details pre {
                    margin: 0;
                    white-space: pre-wrap;
                    font-size: 13px;
                    line-height: 1.5;
                }
                
                .log-entry.thinking {
                    background-color: #e3f2fd;
                }
                
                .log-entry.observation {
                    background-color: #e8f5e9;
                }
                
                .log-entry.completion {
                    background-color: #e8eaf6;
                }
                
                .log-entry.warning {
                    background-color: #fff3e0;
                }
                
                .log-entry.error {
                    background-color: #ffebee;
                }
                
                .log-timestamp {
                    color: #666;
                    font-size: 12px;
                    margin-right: 10px;
                }
                
                .final-response {
                    padding: 15px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background-color: #f9f9f9;
                }
                
                .response-content {
                    white-space: pre-wrap;
                    line-height: 1.5;
                }
            `}</style>
        </div>
    );
};
