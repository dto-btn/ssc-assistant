import React, { useState } from 'react';
import { Box, Tooltip, Paper, Typography, Collapse } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export type ToolCallStatus = 'success' | 'error';

export interface ToolCallChipProps {
    toolCalls: { id: string; status: ToolCallStatus; error?: string }[];
}

const ToolCallChip: React.FC<ToolCallChipProps> = ({ toolCalls }) => {
    const [expanded, setExpanded] = useState(false);

    const handleChipClick = () => {
        setExpanded(!expanded);
    };

    return (
        <Box>
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
            <Collapse in={expanded}>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {toolCalls.map((call) => (
                        <Paper
                            key={call.id}
                            elevation={1}
                            sx={{
                                p: 2,
                                bgcolor: call.status === 'error' ? 'error.light' : 'success.light',
                                border: '1px solid',
                                borderColor: call.status === 'error' ? 'error.main' : 'success.main',
                            }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold"
                                color={call.status === 'error' ? 'error.dark' : 'success.dark'}>
                                {call.status === 'error' ? 'Error' : 'Success'}
                            </Typography>
                            <Typography variant="body2">
                                {call.error || `Tool call ${call.id} completed successfully`}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
};

export default ToolCallChip;
