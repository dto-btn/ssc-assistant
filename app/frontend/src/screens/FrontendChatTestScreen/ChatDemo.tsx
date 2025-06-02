import React, { useState, useRef } from 'react';
import { Box, TextField, Button, Typography, Paper, Avatar, CircularProgress, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAgentCore, useMemoryExports } from './hooks/useAgentCore';
import { AgentCoreEvent, ErrorEvent } from './agents/AgentCoreEvent.types';

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
                    turns.flatMap((turn, turnIndex) =>
                        turn.actions.map((action, actionIndex) => {
                            const id = `turn-${turnIndex}-action-${actionIndex}`;
                            if (action.type === 'action:user-message') {
                                return (
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }} key={id}>
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
                                            <Typography>{action.content}</Typography>
                                        </Paper>
                                    </Box>
                                );
                            } else if (action.type === 'action:agent-message') {
                                return (
                                    <Box sx={{ display: 'flex', mb: 2 }} key={id}>
                                        <Avatar sx={{ bgcolor: 'secondary.main', mr: 1 }}>AI</Avatar>
                                        <Paper
                                            elevation={1}
                                            sx={{
                                                p: 2,
                                                maxWidth: '70%',
                                                borderRadius: '0 1rem 1rem 1rem'
                                            }}
                                        >
                                            <Typography>{action.content}</Typography>
                                        </Paper>
                                    </Box>
                                );
                            } else if (action.type === 'action:agent-thought') {
                                return (
                                    <Box sx={{ display: 'flex', mb: 2 }} key={id}>
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
                                                {action.content}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                );
                            } else if (action.type === 'action:agent-observation') {
                                return (
                                    <Box sx={{ display: 'flex', mb: 2 }} key={id}>
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
                                                {action.content}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                );
                            } else if (action.type === 'action:agent-error') {
                                return (
                                    <Box sx={{ display: 'flex', mb: 2 }} key={id}>
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
                                                {action.content}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                );
                            } else if (action.type === 'action:agent-tool-call') {
                                let args = '';
                                try {
                                    args = JSON.stringify(JSON.parse(action.toolArguments), null, 2);
                                } catch {
                                    args = String(action.toolArguments);
                                }
                                // Parse out function name and arguments for display
                                let funcName = '', funcArgs = '';
                                const match = `${action.toolName}(${args})`.match(/^(\w+)\((.*)\)$/s);
                                if (match) {
                                    funcName = match[1];
                                    funcArgs = match[2];
                                } else {
                                    funcName = action.toolName;
                                    funcArgs = args;
                                }
                                return (
                                    <Box sx={{ display: 'flex', mb: 2 }} key={id}>
                                        <Accordion sx={{ width: '100%', ml: 5, bgcolor: 'warning.light', border: '1px dashed', borderColor: 'warning.main', fontFamily: 'monospace' }}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">
                                                    Function Call: {funcName}
                                                </Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                                    {funcArgs}
                                                </Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Box>
                                );
                            }
                            return null;
                        })
                    ).filter(msg => msg !== null)
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
