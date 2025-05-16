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
    useTheme
} from "@mui/material";
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from "react-i18next";
import { useChat, Message } from "../hooks/useChat";

const ChatPanel: React.FC = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: t("bits.chat.welcome", "Hello! I'm here to help you with BITS queries. How can I assist you today?"),
        },
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Custom system prompt for BITS assistant
    const systemPrompt = "You are a helpful assistant for the Business Information Technology Services (BITS) system. Help users understand how to query and interpret BITS data. If you don't know something specific about BITS, be honest about it.";

    const {
        isLoading,
        currentStreamingMessage,
        sendMessage,
        cancelStream
    } = useChat({ systemPrompt });

    const handleSendMessage = async () => {
        if (input.trim() === "" || isLoading) return;

        const userMessage: Message = {
            role: "user",
            content: input,
        };

        // Add the user's message
        setMessages(prevMessages => [...prevMessages, userMessage]);
        setInput("");

        // Focus the input field after sending
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);

        try {
            // Send all previous messages plus the new one
            const response = await sendMessage([...messages, userMessage]);

            if (response) {
                // Add the assistant's response
                setMessages(prevMessages => [
                    ...prevMessages,
                    { role: "assistant", content: response }
                ]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prevMessages => [
                ...prevMessages,
                {
                    role: "assistant",
                    content: t("bits.chat.error", "Sorry, I encountered an error processing your request. Please try again.")
                }
            ]);
        }
    };

    const handleStopGenerating = () => {
        const interruptedMessage = cancelStream();
        if (interruptedMessage) {
            setMessages(prevMessages => [
                ...prevMessages,
                { role: "assistant", content: interruptedMessage }
            ]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

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
                                                : theme.palette.secondary.main,
                                    }}
                                >
                                    {message.role === "user"
                                        ? t("bits.chat.user", "You")
                                        : t("bits.chat.assistant", "Assistant")}
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

                    {/* Streaming message */}
                    {isLoading && currentStreamingMessage && (
                        <ListItem
                            alignItems="flex-start"
                            sx={{
                                flexDirection: "column",
                                mb: 1,
                                p: 1,
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: "bold",
                                    color: theme.palette.secondary.main,
                                }}
                            >
                                {t("bits.chat.assistant", "Assistant")}
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    width: "100%",
                                }}
                            >
                                {currentStreamingMessage}
                            </Typography>
                        </ListItem>
                    )}

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
                        placeholder={t("bits.chat.input.placeholder", "Type your message here...")}
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
                            {t("bits.chat.stop", "Stop")}
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
                            {isLoading ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                <SendIcon />
                            )}
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

export default ChatPanel;
