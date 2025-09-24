import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { toggleTool } from "../store/slices/toolSlice";
import { setSelectedModel } from "../store/slices/modelSlice";
import { setSessionStaticTools } from "../store/slices/sessionSlice";
import { Box, FormGroup, FormControlLabel, Switch, Select, MenuItem, Typography, Button } from "@mui/material";

const Toolbar: React.FC = () => {
  const enabledTools = useSelector((state: RootState) => state.tools.enabledTools);
  const selectedModel = useSelector((state: RootState) => state.models.selectedModel);
  const availableModels = useSelector((state: RootState) => state.models.availableModels);
  const currentSessionId = useSelector((state: RootState) => state.sessions.currentSessionId);
  const sessions = useSelector((state: RootState) => state.sessions.sessions);
  const dispatch = useDispatch();

  // Find static tools for the current session
  const session = sessions.find(s => s.id === currentSessionId);
  const staticTools = session?.staticTools || [];

  // If staticTools is set, only show those switches enabled and locked
  const effectiveTools = staticTools.length
    ? Object.fromEntries(
        Object.keys(enabledTools).map(tool => [tool, staticTools.includes(tool)])
      )
    : enabledTools;

  return (
    <Box display="flex" alignItems="center" gap={3} p={2} bgcolor="grey.50">
      <FormGroup row>
        {Object.keys(effectiveTools).map((tool) => (
          <FormControlLabel
            key={tool}
            control={
              <Switch
                checked={effectiveTools[tool]}
                onChange={() => {
                  if (!staticTools.length) dispatch(toggleTool(tool));
                }}
                disabled={!!staticTools.length}
              />
            }
            label={tool.charAt(0).toUpperCase() + tool.slice(1)}
          />
        ))}
      </FormGroup>
      <Box>
        <Typography variant="body2" sx={{ mr: 1, display: "inline" }}>Model:</Typography>
        <Select
          size="small"
          value={selectedModel}
          onChange={e => dispatch(setSelectedModel(e.target.value))}
        >
          {availableModels.map(model =>
            <MenuItem key={model} value={model}>{model}</MenuItem>
          )}
        </Select>
      </Box>
      {currentSessionId && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => dispatch(setSessionStaticTools({ id: currentSessionId, tools: Object.keys(enabledTools).filter(t => enabledTools[t]) }))}
          disabled={!!staticTools.length}
        >
          Lock Tools This Session
        </Button>
      )}
    </Box>
  );
};

export default Toolbar;