import { useState } from 'react';
import { useAgentCore } from './hooks/useAgentCore';

export const FrontendChatTestScreen = () => {
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const [agentCoreFinalResponse, setAgentCoreFinalResponse] = useState<string | null>(null);

    const agentCore = useAgentCore();

    const handleAgentCoreQuery = () => {
        setIsBusy(true);
        const cnx = agentCore.processQuery('Write a long poem about the sea.');
        cnx.onComplete(() => {
            setAgentCoreFinalResponse(cnx.getResponseText());
            setIsBusy(false);
        });
        cnx.onError((error) => {
            console.error('Error in AgentCore connection:', error);
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