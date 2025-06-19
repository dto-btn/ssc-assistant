import { Box, Paper, Avatar, Typography } from '@mui/material';
import ToolCallChip, { ToolCallStatus } from './ToolCallChip';

export function groupChatTurnElements(turns: any[]) {
    return turns.flatMap((turn, turnIndex) => {
        const groupedElements = [];
        let toolCallGroup: { id: string; status: ToolCallStatus; error?: string }[] = [];
        const actions = turn.actions;
        for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
            const action = actions[actionIndex];
            const id = `turn-${turnIndex}-action-${actionIndex}`;
            // Group consecutive tool calls, their responses, and agent errors
            if (action.type === 'action:agent-tool-call') {
                // Find the next response for this tool call
                const responseAction = actions.slice(actionIndex + 1).find(
                    (a: any) => a.type === 'action:agent-tool-call-response' && a.toolCallId === action.toolCallId
                );
                // Check for parse or argument errors in the tool call itself
                let parseError: string | undefined = undefined;
                if (action.error) {
                    parseError = typeof action.error === 'string' ? action.error : JSON.stringify(action.error);
                }
                // Determine status and error
                let status: ToolCallStatus = 'success';
                let errorMsg: string | undefined = undefined;
                if (responseAction && responseAction.error) {
                    status = 'error';
                    errorMsg = typeof responseAction.error === 'string' ? responseAction.error : JSON.stringify(responseAction.error);
                } else if (parseError) {
                    status = 'error';
                    errorMsg = parseError;
                }
                toolCallGroup.push({
                    id: action.toolCallId || id,
                    status: status,
                    error: errorMsg
                });
                // Skip the response action in the next iteration
                if (responseAction) {
                    actionIndex = actions.indexOf(responseAction);
                }
                // If next action is not a tool call or agent error, flush the group
                if (
                    actionIndex + 1 >= actions.length ||
                    (actions[actionIndex + 1].type !== 'action:agent-tool-call' && actions[actionIndex + 1].type !== 'action:agent-error')
                ) {
                    if (toolCallGroup.length > 0) {
                        groupedElements.push(
                            <Box sx={{ display: 'flex', mb: 2, ml: 5 }} key={`toolcallchip-${id}`}>
                                <ToolCallChip toolCalls={toolCallGroup} />
                            </Box>
                        );
                        toolCallGroup = [];
                    }
                }
                continue;
            } else if (action.type === 'action:agent-error') {
                // Add agent errors to the tool call group if we're in a tool call sequence
                toolCallGroup.push({
                    id: id,
                    status: 'error',
                    error: action.content
                });
                // If next action is not a tool call or agent error, flush the group
                if (
                    actionIndex + 1 >= actions.length ||
                    (actions[actionIndex + 1].type !== 'action:agent-tool-call' && actions[actionIndex + 1].type !== 'action:agent-error')
                ) {
                    if (toolCallGroup.length > 0) {
                        groupedElements.push(
                            <Box sx={{ display: 'flex', mb: 2, ml: 5 }} key={`toolcallchip-${id}`}>
                                <ToolCallChip toolCalls={toolCallGroup} />
                            </Box>
                        );
                        toolCallGroup = [];
                    }
                }
                continue;
            }
            // Render other actions as before
            if (toolCallGroup.length > 0) {
                groupedElements.push(
                    <Box sx={{ display: 'flex', mb: 2, ml: 5 }} key={`toolcallchip-${id}`}>
                        <ToolCallChip toolCalls={toolCallGroup} />
                    </Box>
                );
                toolCallGroup = [];
            }
            if (action.type === 'action:user-message') {
                groupedElements.push(
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
                groupedElements.push(
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
                groupedElements.push(
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
                groupedElements.push(
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
            }
            // Note: action:agent-error is now handled in the tool call grouping above
        }
        return groupedElements;
    }).filter(msg => msg !== null);
}
