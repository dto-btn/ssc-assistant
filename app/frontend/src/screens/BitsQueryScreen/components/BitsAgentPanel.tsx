import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    List,
    ListItem,
    Divider,
    CircularProgress,
    Button,
    useTheme,
    Chip
} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from "react-i18next";
import { useBitsAgent } from "../hooks/useBitsAgent";

const BitsAgentPanel: React.FC = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([
        {
            role: "assistant",
            content: t("bits.agent.welcome", "Hello! I'm your BITS Query Assistant. I can help you search for business requests and interpret the results. What would you like to search for?"),
        },
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        isLoading,
        currentStreamingMessage,
        sendMessage,
        cancelStream,
        filters,
        statuses,
        queryResults,
        queryMetadata,
        queryError,
        isQueryLoading
    } = useBitsAgent();

    const handleSendMessage = async () => {
        if (input.trim() === "" || isLoading) return;

        // Add user message to local state
        setMessages(prevMessages => [
            ...prevMessages,
            { role: "user", content: input }
        ]);

        setInput("");

        // Focus the input field after sending
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);

        // Send message to agent
        try {
            await sendMessage(input);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleStopGenerating = () => {
        cancelStream();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Update messages when agent state changes
    useEffect(() => {
        if (currentStreamingMessage && isLoading) {
            // Show streaming message by updating the last message if it's from the assistant
            // or adding a new one if the last message is from the user
            setMessages(prevMessages => {
                const lastMessage = prevMessages[prevMessages.length - 1];

                if (lastMessage && lastMessage.role === "assistant" && lastMessage.content === currentStreamingMessage) {
                    return prevMessages;
                }

                if (lastMessage && lastMessage.role === "assistant") {
                    // Replace the last message with the current streaming one
                    return [
                        ...prevMessages.slice(0, prevMessages.length - 1),
                        { role: "assistant", content: currentStreamingMessage }
                    ];
                }

                // Add new assistant message
                return [
                    ...prevMessages,
                    { role: "assistant", content: currentStreamingMessage }
                ];
            });
        }
    }, [currentStreamingMessage, isLoading]);

    // Update for query state changes
    useEffect(() => {
        if (queryResults || queryError) {
            const resultMessage = queryResults
                ? `Query complete! Found ${queryResults.length} results.`
                : `Query error: ${queryError}`;

            // Add system message about query results
            setMessages(prevMessages => {
                // Check if the last message already contains this result
                const lastMessage = prevMessages[prevMessages.length - 1];
                if (lastMessage && lastMessage.role === "system" && lastMessage.content.includes(resultMessage)) {
                    return prevMessages;
                }

                return [
                    ...prevMessages,
                    { role: "system", content: resultMessage }
                ];
            });
        }
    }, [queryResults, queryError]);

    // Scroll to the bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, currentStreamingMessage]);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                backgroundColor: theme.palette.background.paper,
                borderLeft: `1px solid ${theme.palette.divider}`
            }}
        >
            {/* Current state display */}
            <Box
                sx={{
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.default,
                }}
            >
                <Typography variant="subtitle2" gutterBottom>
                    {t("bits.agent.current.state", "Current Query State")}
                </Typography>

                <Typography variant="caption" display="block" gutterBottom>
                    {t("bits.agent.filters", "Filters")}: {filters.length}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {filters.map((filter, index) => (
                        <Chip
                            key={index}
                            label={`${filter.name} ${filter.operator} ${filter.value}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    ))}
                    {filters.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {t("bits.agent.no.filters", "No filters set")}
                        </Typography>
                    )}
                </Box>

                <Typography variant="caption" display="block" gutterBottom>
                    {t("bits.agent.statuses", "Statuses")}: {statuses.length}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {statuses.map((status, index) => (
                        <Chip
                            key={index}
                            label={status}
                            size="small"
                            color="secondary"
                            variant="outlined"
                        />
                    ))}
                    {statuses.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {t("bits.agent.no.statuses", "No statuses selected")}
                        </Typography>
                    )}
                </Box>

                {queryResults && (
                    <Typography variant="body2" color="success.main">
                        {t("bits.agent.results", "Results found")}: {queryResults.length}
                    </Typography>
                )}

                {queryError && (
                    <Typography variant="body2" color="error">
                        {queryError}
                    </Typography>
                )}

                {isQueryLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        <Typography variant="body2">
                            {t("bits.agent.loading", "Executing query...")}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Messages area */}
            <Box
                sx={{
                    flex: 1,
                    overflow: "auto",
                    p: 2,
                }}
            >
                <List>
                    {messages.map((message, index) => (
                        <React.Fragment key={index}>
                            <ListItem
                                alignItems="flex-start"
                                sx={{
                                    flexDirection: "column",
                                    backgroundColor:
                                        message.role === "user"
                                            ? "rgba(0, 0, 0, 0.04)"
                                            : message.role === "system"
                                                ? "rgba(255, 244, 229, 0.6)"
                                                : "transparent",
                                    borderRadius: 1,
                                    mb: 1,
                                    p: 1,
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: "bold",
                                        color:
                                            message.role === "user"
                                                ? theme.palette.primary.main
                                                : message.role === "system"
                                                    ? theme.palette.warning.dark
                                                    : theme.palette.secondary.main,
                                    }}
                                >
                                    {message.role === "user"
                                        ? t("bits.agent.user", "You")
                                        : message.role === "system"
                                            ? t("bits.agent.system", "System")
                                            : t("bits.agent.assistant", "Assistant")}
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        width: "100%",
                                    }}
                                >
                                    {message.content}
                                </Typography>
                            </ListItem>
                            {index < messages.length - 1 && (
                                <Divider variant="middle" component="li" />
                            )}
                        </React.Fragment>
                    ))}

                    {/* End reference for auto-scrolling */}
                    <div ref={messagesEndRef} />
                </List>
            </Box>

            {/* Input area */}
            <Box
                sx={{
                    p: 2,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.default,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "flex-end" }}>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t("bits.agent.input.placeholder", "Ask me to search for business requests...")}
                        variant="outlined"
                        size="small"
                        inputRef={inputRef}
                        disabled={isLoading}
                        sx={{ mr: 1 }}
                    />
                    {isLoading ? (
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={handleStopGenerating}
                            startIcon={<StopIcon />}
                            sx={{ height: 40 }}
                        >
                            {t("bits.agent.stop", "Stop")}
                        </Button>
                    ) : (
                        <IconButton
                            color="primary"
                            onClick={handleSendMessage}
                            disabled={input.trim() === "" || isLoading}
                            sx={{
                                backgroundColor: theme.palette.primary.main,
                                color: "white",
                                "&:hover": {
                                    backgroundColor: theme.palette.primary.dark,
                                },
                                height: 40,
                                width: 40,
                            }}
                        >
                            <SendIcon />
                        </IconButton>
                    )}
                </Box>
                <Typography
                    variant="caption"
                    sx={{
                        display: "block",
                        textAlign: "center",
                        mt: 1,
                        color: "text.secondary",
                        fontSize: "11px",
                    }}
                >
                    {t("ai.disclaimer", "AI may make mistakes. Please validate all information before use.")}
                </Typography>
            </Box>
        </Box>
    );
};

export default BitsAgentPanel;
