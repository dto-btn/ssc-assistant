import React, { useCallback, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type cytoscape from "cytoscape";
import { Box, CircularProgress, Typography, Button, Tooltip } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { deleteMemoryNode } from "../store/thunks/memoryThunks";

const GRAPH_STYLE: cytoscape.Stylesheet[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#1976d2",
      color: "#fff",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "11px",
      width: 80,
      height: 80,
      "text-wrap": "wrap",
      "text-max-width": "70px",
    } as cytoscape.Css.Node,
  },
  {
    selector: "node:selected",
    style: {
      "background-color": "#d32f2f",
    } as cytoscape.Css.Node,
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#90a4ae",
      "target-arrow-color": "#90a4ae",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": "10px",
      color: "#546e7a",
      "text-rotation": "autorotate",
    } as cytoscape.Css.Edge,
  },
];

const MemoryGraph: React.FC = () => {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();
  const graphData = useAppSelector((state) => state.memory.graphData);
  const isLoading = useAppSelector((state) => state.memory.isLoadingGraph);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeLabel, setSelectedNodeLabel] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const elements = React.useMemo(() => {
    if (!graphData) return [];
    return [
      ...(graphData.nodes ?? []),
      ...(graphData.edges ?? []),
    ];
  }, [graphData]);

  const handleCyReady = useCallback((cy: cytoscape.Core) => {
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      setSelectedNodeId(node.id());
      setSelectedNodeLabel(node.data("label") as string);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
        setSelectedNodeLabel(null);
      }
    });
  }, []);

  const handleDeleteSelected = async () => {
    if (!selectedNodeId) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteMemoryNode(selectedNodeId));
      setSelectedNodeId(null);
      setSelectedNodeLabel(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!graphData || elements.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("memory.graph.empty")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          height: 380,
          mb: 1,
        }}
      >
        <CytoscapeComponent
          elements={elements}
          style={{ width: "100%", height: "100%" }}
          stylesheet={GRAPH_STYLE}
          layout={{ name: "cose", padding: 20, animate: false }}
          cy={handleCyReady}
        />
      </Box>
      {selectedNodeId && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {t("memory.graph.selectedNode")}: <strong>{selectedNodeLabel}</strong>
          </Typography>
          <Tooltip title={t("memory.graph.deleteNode")}>
            <span>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={isDeleting ? <CircularProgress size={14} color="error" /> : <DeleteIcon />}
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                {t("memory.graph.deleteNode")}
              </Button>
            </span>
          </Tooltip>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        {t("memory.graph.hint")}
      </Typography>

      {/* Node list — always show stored memories as readable text */}
      {graphData.nodes.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: "block", mb: 0.5 }}>
            Stored memories ({graphData.nodes.length})
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {graphData.nodes.map((n) => (
              <Box component="li" key={n.data.id} sx={{ mb: 0.5 }}>
                <Typography variant="caption" fontWeight="bold">{n.data.label}</Typography>
                <Typography variant="caption" color="text.secondary"> — {n.data.text}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MemoryGraph;
