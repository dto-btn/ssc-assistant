import React, { useState, useRef } from 'react';
import { Box, TextField, Button, Typography, Paper, Avatar, CircularProgress, Divider } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAgentCore, useMemoryExports } from './hooks/useAgentCore';
import { AgentCoreEvent, ErrorEvent } from './agents/AgentCoreEvent.types';
import { AgentToolCallResponse } from './agents/AgentCoreMemory.types';
import ToolCallChip from './ToolCallChip';
import { groupChatTurnElements } from './groupChatTurnElements';

export const ChatDemo = () => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [streamingAgentOutput, setStreamingAgentOutput] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const {
        agentCore,
        memory
    } = useAgentCore();

    const turns = useMemoryExports(memory);

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        console.log('Form submitted with input:', input);
        e.preventDefault();

        if (!input.trim() || isProcessing) return;

        const connection = agentCore.processQuery(input.trim(), {
            useStreaming: true
        });
        setInput('');
        setIsProcessing(true);

        // Set up event listeners
        connection.onEvent((event: AgentCoreEvent) => {
            console.log('Event received:', event);

            switch (event.type) {
                case 'started':
                    setStreamingAgentOutput('');
                    setIsProcessing(true);
                    break;

                case 'error':
                    const errorEvent = event as ErrorEvent;
                    console.error('Error occurred:', errorEvent.data.content);
                    setIsProcessing(false);
                    break;

                case 'finished':
                    setStreamingAgentOutput('');
                    setIsProcessing(false);
                    break;

                case 'debug-log':
                    console.debug('Debug log:', event.data.logContent);
                    break;

                case 'streaming-message-update':
                    console.log('Streaming message update:', event.data.content);
                    setStreamingAgentOutput(event.data.content);
                    break;

                default:
                    console.error(`Received an unknown event type. All event types should be handled`, event);
                    break;
            }
        });
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" component="h1" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                AgentCore Chat Demo
            </Typography>

            <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
                {turns.length === 0 ? (
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        color: 'text.secondary'
                    }}>
                        <Typography variant="body1">
                            Start a conversation by typing a message below
                        </Typography>
                    </Box>
                ) : (
                    groupChatTurnElements(turns)
                )}

                {streamingAgentOutput && (
                    <Box sx={{ display: 'flex', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.main', mr: 1 }}>AI</Avatar>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '70%',
                                borderRadius: '0 1rem 1rem 1rem'
                            }}
                        >
                            <Typography>{streamingAgentOutput}</Typography>
                        </Paper>
                    </Box>

                )}

                {isProcessing && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                <div ref={messagesEndRef} />
            </Box>

            <Divider />

            <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, display: 'flex' }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type your message here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isProcessing}
                    sx={{ mr: 1 }}
                />
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isProcessing || !input.trim()}
                    endIcon={<SendIcon />}
                >
                    Send
                </Button>
            </Box>
        </Box>
    );
};
