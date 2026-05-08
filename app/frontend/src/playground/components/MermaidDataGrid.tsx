import React, { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { toDisplayValue } from "../../utils/displayValue";

export interface MermaidDataGridRow {
  id: string;
  [key: string]: unknown;
}

interface MermaidDataGridProps {
  rows: MermaidDataGridRow[];
}

const MermaidDataGrid: React.FC<MermaidDataGridProps> = ({ rows }) => {
  const { t } = useTranslation();
  const normalizedRows = useMemo(() => {
    return rows.map((row) => {
      const normalizedRow: MermaidDataGridRow = { id: String(row.id) };
      Object.entries(row).forEach(([key, value]) => {
        if (key === "id") {
          return;
        }
        // Normalize mixed Mermaid-derived values into predictable grid-safe primitives.
        normalizedRow[key] = toDisplayValue(value);
      });
      return normalizedRow;
    });
  }, [rows]);

  const columns = useMemo<GridColDef[]>(() => {
    const keySet = new Set<string>();
    for (const row of normalizedRows) {
      Object.keys(row).forEach((key) => {
        if (key !== "id") {
          keySet.add(key);
        }
      });
    }

    const preferredOrder = ["type", "source", "target", "relation", "label", "value", "message", "content"];
    const orderedKeys = [
      ...preferredOrder.filter((key) => keySet.has(key)),
      ...Array.from(keySet).filter((key) => !preferredOrder.includes(key)).sort(),
    ];

    return orderedKeys.map((key) => {
      const isNumeric = normalizedRows.some((row) => typeof row[key] === "number");
      return {
        field: key,
        headerName: key.charAt(0).toUpperCase() + key.slice(1),
        flex: key === "content" || key === "label" || key === "message" ? 1.2 : 1,
        minWidth: key === "content" || key === "message" ? 220 : 140,
        type: isNumeric ? "number" : "string",
      } as GridColDef;
    });
  }, [normalizedRows]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>
        {t("mermaid.chart.data")}
      </Typography>
      <Paper sx={{ width: "100%", minHeight: 280 }} elevation={1}>
        <DataGrid
          rows={normalizedRows}
          columns={columns}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
          showToolbar
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
              csvOptions: { fileName: "chart-data", utf8WithBom: true },
            },
          }}
          sx={{ border: 0 }}
        />
      </Paper>
    </Box>
  );
};

export default MermaidDataGrid;
