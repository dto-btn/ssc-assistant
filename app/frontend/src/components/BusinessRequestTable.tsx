import React from "react";
import {
  Box,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataGrid, GridColDef, GridValueGetter } from "@mui/x-data-grid";

interface BusinessRequestTableProps {
  data: Array<BusinessRequest>;
  lang: string;
}

const BusinessRequestTable: React.FC<BusinessRequestTableProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const theme = useTheme();

  const columns: GridColDef[] = [
    {
      field: "BR_NMBR",
      headerName: t("business.request.number.short"),
      width: 75,
      renderCell: (params) => (
        <Link
          href={`https://bitsprod.ssc-spc.gc.ca/BR/${params.value}`}
          rel="noopener"
          target="_blank"
        >
          #{params.value}
        </Link>
      ),
    },
    {
      field: "BR_SHORT_TITLE",
      headerName: t("business.request.title"),
      width: 250,
    },
    {
      field: isEnglish ? "RPT_GC_ORG_NAME_EN" : "RPT_GC_ORG_NAME_FR",
      headerName: t("client.name"),
      width: 200,
    },
    { field: "BR_OWNER", headerName: t("br.owner"), width: 150 },
    {
      field: isEnglish ? "BITS_STATUS_EN" : "BITS_STATUS_FR",
      headerName: t("status"),
      width: 125,
    },
    {
      field: isEnglish ? "PRIORITY_EN" : "PRIORITY_FR",
      headerName: t("priority"),
      width: 100,
    },
    {
      field: "SUBMIT_DATE",
      headerName: t("submit.date"),
      width: 150,
      valueGetter: (value, row) =>
        new Date(value).toLocaleString("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
    },
  ];

  const paginationModel = { page: 0, pageSize: 10 };

  return (
    <Box>
      <TableContainer
        component={Paper}
        sx={{ backgroundColor: theme.palette.secondary.contrastText }}
      >
        <DataGrid
          rows={data}
          columns={columns}
          getRowId={(row) => row.BR_NMBR}
          initialState={{ pagination: { paginationModel } }}
          pageSizeOptions={[5, 10]}
          checkboxSelection
          sx={{
            border: 0,
            backgroundColor: theme.palette.secondary.contrastText,
          }}
        />
      </TableContainer>
    </Box>
  );
};

export default BusinessRequestTable;
