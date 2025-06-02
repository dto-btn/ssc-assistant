import React, { useState, useRef } from 'react';
import { Box, TextField, Button, Typography, Paper, Avatar, CircularProgress, Divider } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAgentCore, useMemoryExports } from './hooks/useAgentCore';
import { AgentCoreEvent, ErrorEvent } from './agents/AgentCoreEvent.types';

// Message types for our chat interface
type MessageType = 'user' | 'agent' | 'thought' | 'observation' | 'error';

interface Message {
    id: string;
    type: MessageType;
    content: string;
}

export const ChatDemo = () => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
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

        const connection = agentCore.processQuery(input.trim());
        setInput('');
        setIsProcessing(true);

        // Set up event listeners
        connection.onEvent((event: AgentCoreEvent) => {
            console.log('Event received:', event);

            switch (event.type) {
                case 'started':
                    setIsProcessing(true);
                    break;

                case 'error':
                    const errorEvent = event as ErrorEvent;
                    console.error('Error occurred:', errorEvent.data.content);
                    setIsProcessing(false);
                    break;

                case 'finished':
                    setIsProcessing(false);
                    break;
            }
        });
    };

    // Render a message based on its type
    const renderMessage = (message: Message) => {
        switch (message.type) {
            case 'user':
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }} key={message.id}>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '70%',
                                bgcolor: 'primary.light',
                                color: 'primary.contrastText',
                                borderRadius: '1rem 0 1rem 1rem'
                            }}
                        >
                            <Typography>{message.content}</Typography>
                        </Paper>
                    </Box>
                );

            case 'agent':
                return (
                    <Box sx={{ display: 'flex', mb: 2 }} key={message.id}>
                        <Avatar sx={{ bgcolor: 'secondary.main', mr: 1 }}>AI</Avatar>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '70%',
                                borderRadius: '0 1rem 1rem 1rem'
                            }}
                        >
                            <Typography>{message.content}</Typography>
                        </Paper>
                    </Box>
                );

            case 'thought':
                return (
                    <Box sx={{ display: 'flex', mb: 2 }} key={message.id}>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '85%',
                                ml: 5,
                                borderRadius: '0.5rem',
                                bgcolor: 'info.light',
                                border: '1px dashed',
                                borderColor: 'info.main'
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold" color="info.dark">
                                Thinking...
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                {message.content}
                            </Typography>
                        </Paper>
                    </Box>
                );

            case 'observation':
                return (
                    <Box sx={{ display: 'flex', mb: 2 }} key={message.id}>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '85%',
                                ml: 5,
                                borderRadius: '0.5rem',
                                bgcolor: 'success.light',
                                border: '1px dashed',
                                borderColor: 'success.main'
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold" color="success.dark">
                                Observation
                            </Typography>
                            <Typography variant="body2">
                                {message.content}
                            </Typography>
                        </Paper>
                    </Box>
                );

            case 'error':
                return (
                    <Box sx={{ display: 'flex', mb: 2 }} key={message.id}>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 2,
                                maxWidth: '85%',
                                ml: 5,
                                borderRadius: '0.5rem',
                                bgcolor: 'error.light',
                                border: '1px solid',
                                borderColor: 'error.main'
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold" color="error.dark">
                                Error
                            </Typography>
                            <Typography variant="body2">
                                {message.content}
                            </Typography>
                        </Paper>
                    </Box>
                );
        }
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
                    turns.flatMap((turn, turnIndex) => {
                        if (turn.type === 'turn:user') {
                            return turn.actions.map((action, actionIndex) => {
                                if (action.type === 'action:user-message') {
                                    return renderMessage({
                                        id: `turn-${turnIndex}-action-${actionIndex}`,
                                        type: 'user',
                                        content: action.content
                                    });
                                }
                                return null;
                            });
                        } else if (turn.type === 'turn:agent') {
                            return turn.actions.map((action, actionIndex) => {
                                const id = `turn-${turnIndex}-action-${actionIndex}`;

                                if (action.type === 'action:agent-message') {
                                    return renderMessage({
                                        id,
                                        type: 'agent',
                                        content: action.content
                                    });
                                } else if (action.type === 'action:agent-thought') {
                                    return renderMessage({
                                        id,
                                        type: 'thought',
                                        content: action.content
                                    });
                                } else if (action.type === 'action:agent-observation') {
                                    return renderMessage({
                                        id,
                                        type: 'observation',
                                        content: action.content
                                    });
                                } else if (action.type === 'action:agent-error') {
                                    return renderMessage({
                                        id,
                                        type: 'error',
                                        content: action.content
                                    });
                                }
                                // Tool calls and other action types aren't displayed directly
                                return null;
                            }).filter(Boolean); // Remove null values
                        }
                        return null;
                    }).filter(msg => msg !== null) // Filter out any null messages
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
