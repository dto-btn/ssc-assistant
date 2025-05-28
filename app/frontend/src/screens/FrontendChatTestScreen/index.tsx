import { useState } from 'react';
import { useAgentCore } from './hooks/useAgentCore';
import { AgentProgressData } from './agents/AgentCoreResponse';
import { AgentProgressDemo } from './components/AgentProgressDemo';

export const FrontendChatTestScreen = () => {
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [agentCoreFinalResponse, setAgentCoreFinalResponse] = useState<string | null>(null);
    const [progress, setProgress] = useState<AgentProgressData | null>(null);
    const [query, setQuery] = useState<string>('Write a long poem about the sea.');

    const agentCore = useAgentCore();

    const handleAgentCoreQuery = () => {
        setIsBusy(true);
        setProgress(null);
        setAgentCoreFinalResponse(null);

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

        cnx.onProgress((progressData) => {
            setProgress(progressData);
        });
    }

    // Calculate progress percentage
    const progressPercentage = progress
        ? Math.min(100, Math.round((progress.currentIteration / progress.maxIterations) * 100))
        : 0;

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

            <hr style={{ margin: '30px 0' }} />

            {/* Advanced progress tracking demo */}
            <AgentProgressDemo />
        </div>
    )
}