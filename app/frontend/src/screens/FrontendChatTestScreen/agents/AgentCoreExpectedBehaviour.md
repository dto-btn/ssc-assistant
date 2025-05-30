# Simple message

```ts
// instantiation
const openai = OpenAI();
const agentCoreMemory = AgentCoreMemory();
const agentCore = AgentCore(openai, agentCoreMemory);

// usage
let incomingMessage = '';
const turnCnx = agentCore.processQuery("What is an apple?");
connection.onEvent((event: AgentCoreEvent) => {
    if (!event.type.startsWith('message-stream-')) {
        // non-streaming messages should reset the incomingMessage
        incomingMessage = '';
    }
    switch (event.type) {
        case 'started':
            console.log('Agent started querying.');
            break;
        case 'message':
            console.log('Agent responded with a plaintext message.');
            break;
        case 'message-stream-start':
            console.log('Agent started a streaming message. You can expect the next several messages to be chunks.');
            break;
        case 'message-stream-chunk':
            console.log('Chunk received.', event.data.content);
            incomingMessage += event.data.content;
            break;
        case 'message-stream-finish':
            console.log('Incoming stream completed');
            console.log('The finished message:', incomingMessage);
            incomingMessage = '';
            if (event.data.success) {
                console.log('Stream success.');
            } else {
                console.log('Stream failed.');
            }
            break;
        case 'thought':
            console.log('Agent thought.', event.data.content);
            break;
        case 'observation':
            console.log('Agent observed.', event.data.content);
            break;
        case 'tool-start':
            console.log('Agent used a tool.', event.data.toolName, 'with ID', event.data.toolId);
            console.log('Parameters were:', event.data.parameters);
            console.log('This tool invocation has a unique ID:', event.data.invocationId);
            break;
        case 'tool-finish':
            console.log('Tool called', event.data.toolName, 'with ID', event.data.toolId, 'has finished successfully.');
            console.log('This is specifically in relation to invocationId', event.data.invocationId);
            console.log('Success details are currently not published in this event, but are stored internally.');
            break;
        case 'tool-error':
            console.log('Tool called', event.data.toolName, 'with ID', event.data.toolId, 'had an error.');
            console.log('This is specifically in relation to invocationId', event.data.invocationId);
            console.log('Error details are currently not published in this event, but are stored internally.');
            break;
        case 'finished':
            console.log('Agent has finished with reason', event.data.finishReason);
            switch (event.data.finishReason) {
                case 'stop':
                    console.log('Normal completion.');
                    break;
                case 'iterationLimitReached':
                    console.log('Agent reached its iteration limit.');
                    break;
                case 'error':
                    console.log('Agent finished due to an error.');
                    console.error('Agent had error.', event.data.errorReason);
                    break;
                default:
                    break;
            }
            break;
        case 'error':
            console.error('Agent had error.', event.data.content);
            break;
        case 'debug-log':
            console.log("Log level:", event.data.logLevel); // error, info, debug
            console.log("Log content:", event.data.logContent);
            break;
        default:
            break;
    }
});

// You can also always get the latest events by querying the turn connection object.
console.log(turnCnx.getEvents());

// Turn connection object can be queried
switch(turnCnx.getStatus()) {
    case 'active':
        console.log('is active');
        break;
    case 'finished':
        console.log('is finished');
        break;
    case 'stopping':
        console.log('is stopping by request of user');
    default:
        break;
}

// Turn can be stopped
turnCnx.stop();
```