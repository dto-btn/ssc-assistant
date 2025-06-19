import React, { useState } from 'react';
import { Box, Tooltip, Paper, Typography, Drawer, IconButton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';

export type ToolCallStatus = 'success' | 'error';

export interface ToolCallChipProps {
    toolCalls: {
        id: string;
        status: ToolCallStatus;
        error?: string;
        toolName?: string;
        inputParams?: string;
        outputParams?: string;
    }[];
}

const ToolCallChip: React.FC<ToolCallChipProps> = ({ toolCalls }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleChipClick = () => {
        setDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setDrawerOpen(false);
    };

    return (
        <>
            <Box
                onClick={handleChipClick}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.5,
                    borderRadius: '16px',
                    bgcolor: 'warning.light',
                    border: '1px solid',
                    borderColor: 'warning.main',
                    minHeight: 32,
                    minWidth: 32,
                    gap: 0.5,
                    cursor: 'pointer',
                    '&:hover': {
                        bgcolor: 'warning.main',
                    },
                }}
            >
                {toolCalls.map((call) => (
                    <Tooltip key={call.id} title={call.error || call.status} placement="top">
                        <span>
                            {call.status === 'success' ? (
                                <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                                <ErrorIcon color="error" fontSize="small" />
                            )}
                        </span>
                    </Tooltip>
                ))}
            </Box>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={handleDrawerClose}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 400,
                        p: 2,
                    },
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Tool Call Details</Typography>
                    <IconButton onClick={handleDrawerClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {toolCalls.map((call) => (
                        <Paper
                            key={call.id}
                            elevation={1}
                            sx={{
                                p: 2,
                                bgcolor: '#fafafa',
                                border: '1px solid',
                                borderColor: call.status === 'error' ? 'error.main' : 'success.main',
                                position: 'relative',
                            }}
                        >
                            <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                {call.status === 'success' ? (
                                    <CheckCircleIcon color="success" fontSize="small" />
                                ) : (
                                    <ErrorIcon color="error" fontSize="small" />
                                )}
                            </Box>

                            <Typography variant="subtitle2" fontWeight="bold" sx={{ pr: 4 }}>
                                {call.toolName || 'Tool Call'}
                            </Typography>

                            {call.inputParams && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" fontWeight="bold">Input Parameters:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 1, borderRadius: 1, mt: 0.5 }}>
                                        {call.inputParams}
                                    </Typography>
                                </Box>
                            )}

                            {call.outputParams && call.status === 'success' && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" fontWeight="bold">Output:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 1, borderRadius: 1, mt: 0.5 }}>
                                        {call.outputParams}
                                    </Typography>
                                </Box>
                            )}

                            {call.error && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" fontWeight="bold" color="error">Error Details:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', bgcolor: '#f5f5f5', p: 1, borderRadius: 1, mt: 0.5 }}>
                                        {call.error}
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    ))}
                </Box>
            </Drawer>
        </>
    );
};

export default ToolCallChip;
