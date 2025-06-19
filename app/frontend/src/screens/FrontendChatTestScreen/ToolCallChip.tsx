import React from 'react';
import { Box, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export type ToolCallStatus = 'success' | 'error';

export interface ToolCallChipProps {
    toolCalls: { id: string; status: ToolCallStatus; error?: string }[];
}

const ToolCallChip: React.FC<ToolCallChipProps> = ({ toolCalls }) => (
    <Box
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
);

export default ToolCallChip;
