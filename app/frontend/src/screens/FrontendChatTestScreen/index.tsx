import { useState } from 'react';
import { useAgentCore } from './hooks/useAgentCore';
import { AgentProgressData } from "./agents/AgentCoreConnection.types";

export const FrontendChatTestScreen = () => {
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [agentCoreFinalResponse, setAgentCoreFinalResponse] = useState<string | null>(null);
    const [progress, setProgress] = useState<AgentProgressData | null>(null);
    const [query, setQuery] = useState<string>('Write a long poem about the sea.');
    const [progressSteps, setProgressSteps] = useState<Array<{
        type: string,
        content: string,
        details?: string,
        expanded: boolean
    }>>([]);

    const agentCore = useAgentCore();

    const handleAgentCoreQuery = () => {
        setIsBusy(true);
        setProgress(null);
        setAgentCoreFinalResponse(null);
        setProgressSteps([]);

        const cnx = agentCore.processQuery(query);

        cnx.onComplete(() => {
            setAgentCoreFinalResponse(cnx.getResponseText());
            setIsBusy(false);
        });

        cnx.onError((error) => {
            console.error('Error in AgentCore connection:', error);
            setAgentCoreFinalResponse('Error processing query');
            setIsBusy(false);
        });

        cnx.onEvent((progressData) => {
            setProgress(progressData);

            if (progressData.lastAction && progressData.lastActionContent) {
                const actionType = progressData.lastAction;

                if (actionType === 'think' || actionType === 'observe') {
                    // Only add the step if it's actually from a tool call
                    setProgressSteps(prev => [...prev, {
                        type: actionType,
                        content: actionType === 'think' ? `Thinking (Step ${progressData.reasoningSteps})` : 'Observation',
                        details: progressData.lastActionContent,
                        expanded: false
                    }]);
                }
            }
        });
    }

    // Calculate progress percentage
    const progressPercentage = progress
        ? Math.min(100, Math.round((progress.currentIteration / progress.maxIterations) * 100))
        : 0;

    // Toggle step expansion
    const toggleStepExpansion = (index: number) => {
        setProgressSteps(prev => {
            console.log('Toggling step expansion for index:', index);

            // Create a new array with all items
            return prev.map((step, i) => {
                // Only modify the item at the specified index
                if (i === index) {
                    console.log(`Toggling from ${step.expanded} to ${!step.expanded}`);
                    // Create a new object with the expanded property toggled
                    return {
                        ...step,
                        expanded: !step.expanded
                    };
                }
                // Return other items unchanged
                return step;
            });
        });
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Frontend Chat Test Screen</h1>

            <div style={{ marginBottom: '20px' }}>
                <h2>Simple Agent Test</h2>
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ width: '100%', minHeight: '80px', padding: '8px', marginBottom: '10px' }}
                />
                <button
                    onClick={() => handleAgentCoreQuery()}
                    disabled={isBusy}
                    style={{ padding: '8px 16px' }}
                >
                    {isBusy ? 'Processing...' : 'Send Message'}
                </button>

                {isBusy && progress && (
                    <div style={{ marginTop: '10px' }}>
                        <p>Status: Processing... ({progressPercentage}%)</p>
                        <div style={{
                            width: '100%',
                            height: '20px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progressPercentage}%`,
                                height: '100%',
                                backgroundColor: '#4CAF50',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <p>
                            Iteration: {progress.currentIteration}/{progress.maxIterations} |
                            Reasoning Steps: {progress.reasoningSteps}
                        </p>
                    </div>
                )}

                {/* Progress Steps */}
                {progressSteps.length > 0 && (
                    <div style={{ marginTop: '20px', border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                        <h3 style={{ margin: '0', padding: '10px 15px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                            Progress Steps
                        </h3>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {progressSteps.map((step, index) => (
                                <div key={index} style={{
                                    borderBottom: index < progressSteps.length - 1 ? '1px solid #e0e0e0' : 'none',
                                    backgroundColor: step.type === 'think' ? '#f0f7ff' : '#f0fff7'
                                }}>
                                    <div
                                        onClick={() => toggleStepExpansion(index)}
                                        style={{
                                            padding: '10px 15px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ marginRight: '10px', fontSize: '10px', color: '#666' }}>
                                            {step.expanded ? '▼' : '►'}
                                        </span>
                                        <strong>{step.content}</strong>
                                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                            (Click to {step.expanded ? 'collapse' : 'expand'})
                                        </span>
                                    </div>
                                    {step.expanded && step.details && (
                                        <div style={{
                                            padding: '10px 15px',
                                            backgroundColor: '#fff',
                                            borderTop: '1px solid #eee'
                                        }}>
                                            <pre style={{
                                                margin: '0',
                                                whiteSpace: 'pre-wrap',
                                                fontSize: '14px',
                                                lineHeight: '1.5'
                                            }}>
                                                {step.details}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {agentCoreFinalResponse && (
                    <div style={{ marginTop: '20px' }}>
                        <h2>Final Response</h2>
                        <pre style={{
                            whiteSpace: 'pre-wrap',
                            backgroundColor: '#f5f5f5',
                            padding: '15px',
                            borderRadius: '4px'
                        }}>
                            {agentCoreFinalResponse}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}