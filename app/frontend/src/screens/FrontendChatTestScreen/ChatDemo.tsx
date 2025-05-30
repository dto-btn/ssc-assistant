import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, Avatar, CircularProgress, Divider } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAgentCore } from './hooks/useAgentCore';
import { AgentCoreEvent, ThoughtEvent, ObservationEvent, ErrorEvent, FinishedEvent } from './agents/AgentCoreEvent.types';
import { TurnConnection } from './agents/TurnConnection';

// Message types for our chat interface
type MessageType = 'user' | 'agent' | 'thought' | 'observation' | 'error';

interface Message {
    id: string;
    type: MessageType;
    content: string;
}

export const ChatDemo = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const agentCore = useAgentCore();

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Generate a unique ID for messages
    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!input.trim() || isProcessing) return;

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            type: 'user',
            content: input.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsProcessing(true);

        // Process the query using AgentCore
        const connection = agentCore.processQuery(userMessage.content);

        // Set up event listeners
        connection.onEvent((event: AgentCoreEvent) => {
            console.log('Event received:', event);

            switch (event.type) {
                case 'thought':
                    const thoughtEvent = event as ThoughtEvent;
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        type: 'thought',
                        content: thoughtEvent.data.content
                    }]);
                    break;

                case 'observation':
                    const observationEvent = event as ObservationEvent;
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        type: 'observation',
                        content: observationEvent.data.content
                    }]);
                    break;

                case 'message':
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        type: 'agent',
                        content: event.data.content
                    }]);
                    break;

                case 'error':
                    const errorEvent = event as ErrorEvent;
                    setMessages(prev => [...prev, {
                        id: generateId(),
                        type: 'error',
                        content: errorEvent.data.content
                    }]);
                    setIsProcessing(false);
                    break;

                case 'finished':
                    const finishedEvent = event as FinishedEvent;
                    console.log('Finished with reason:', finishedEvent.data.finishReason);
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
                {messages.length === 0 ? (
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
                    messages.map(message => renderMessage(message))
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
