import { useState } from 'react';
import { useAgentCore } from './hooks/useAgentCore';

export const FrontendChatTestScreen = () => {
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const [agentCoreFinalResponse, setAgentCoreFinalResponse] = useState<string | null>(null);

    const agentCore = useAgentCore();

    const handleAgentCoreQuery = () => {
        setIsBusy(true);
        agentCore.processQuery('Write a long poem about the sea.')
            .then((response) => {
                console.log('Agent Core Response:', response);
                setAgentCoreFinalResponse(response);
                setIsBusy(false);
            })
            .catch((error) => {
                console.error('Error processing query:', error);
                setAgentCoreFinalResponse('Error processing query');
                setIsBusy(false);
            });
    }

    return (
        <div>
            <h1>Frontend Chat Test Screen</h1>
            <p>Status: {isBusy ? 'Processing...' : 'Idle'}</p>
            <button onClick={() => handleAgentCoreQuery()}>Send Message</button>
            <div>
                <h2>Final Response</h2>
                <pre>{agentCoreFinalResponse}</pre>
            </div>

        </div>
    )
}