import React from "react";
import { Box, Link, Paper, TableContainer, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { formatDate } from "./subcomponents/DateDisplay";

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
      headerName: t("BR_SHORT_TITLE"),
      width: 250,
    },
    {
      field: isEnglish ? "RPT_GC_ORG_NAME_EN" : "RPT_GC_ORG_NAME_FR",
      headerName: t("client.name"),
      width: 200,
    },
    { field: "BR_OWNER", headerName: t("BR_OWNER"), width: 150 },
    {
      field: isEnglish ? "BITS_STATUS_EN" : "BITS_STATUS_FR",
      headerName: t("status"),
      width: 125,
    },
    {
      field: isEnglish ? "PHASE_EN" : "PHASE_FR",
      headerName: t("PHASE"),
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
      valueGetter: (value) => formatDate(value),
    },
    {
      field: isEnglish ? "LEAD_PRODUCT_EN" : "LEAD_PRODUCT_FR",
      headerName: t("LEAD_PRODUCT"),
      width: 200,
    },
    {
      field: isEnglish ? "BR_TYPE_EN" : "BR_TYPE_FR",
      headerName: t("br.type"),
      width: 200,
    },
    {
      field: isEnglish ? "SCOPE_EN" : "SCOPE_FR",
      headerName: t("scope"),
      width: 200,
    },
    {
      field: "REQST_IMPL_DATE",
      headerName: t("REQST_IMPL_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "RVSD_TARGET_IMPL_DATE",
      headerName: t("RVSD_TARGET_IMPL_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "ACTUAL_IMPL_DATE",
      headerName: t("ACTUAL_IMPL_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "CLIENT_REQST_SOL_DATE",
      headerName: t("CLIENT_REQST_SOL_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "AGRMT_END_DATE",
      headerName: t("AGRMT_END_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "PRPO_TARGET_DATE",
      headerName: t("PRPO_TARGET_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "IMPL_SGNOFF_DATE",
      headerName: t("IMPL_SGNOFF_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    {
      field: "TARGET_IMPL_DATE",
      headerName: t("TARGET_IMPL_DATE"),
      width: 150,
      valueGetter: (value) => formatDate(value),
    },
    { field: "ACC_MANAGER_OPI", headerName: t("ACC_MANAGER_OPI"), width: 150 },
    { field: "AGR_OPI", headerName: t("AGR_OPI"), width: 150 },
    { field: "BA_OPI", headerName: t("BA_OPI"), width: 150 },
    { field: "BA_PRICING_OPI", headerName: t("BA_PRICING_OPI"), width: 150 },
    { field: "BA_PRICING_TL", headerName: t("BA_PRICING_TL"), width: 150 },
    { field: "BA_TL", headerName: t("BA_TL"), width: 150 },
    { field: "CSM_DIRECTOR", headerName: t("CSM_DIRECTOR"), width: 150 },
    { field: "EAOPI", headerName: t("EAOPI"), width: 150 },
    { field: "PM_OPI", headerName: t("PM_OPI"), width: 150 },
    { field: "QA_OPI", headerName: t("QA_OPI"), width: 150 },
    { field: "SDM_TL_OPI", headerName: t("SDM_TL_OPI"), width: 150 },
    { field: "TEAMLEADER", headerName: t("TEAMLEADER"), width: 150 },
    { field: "WIO_OPI", headerName: t("WIO_OPI"), width: 150 },
    { field: "PROD_OPI", headerName: t("PROD_OPI"), width: 150 },
    {
      field: isEnglish ? "CPLX_EN" : "CPLX_FR",
      headerName: t("complexity"),
      width: 150,
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
          initialState={{
            pagination: {
              paginationModel,
            },
            columns: {
              columnVisibilityModel: {
                LEAD_PRODUCT_EN: false,
                LEAD_PRODUCT_FR: false,
                BR_TYPE_EN: false,
                BR_TYPE_FR: false,
                SCOPE_EN: false,
                SCOPE_FR: false,
                REQST_IMPL_DATE: false,
                RVSD_TARGET_IMPL_DATE: false,
                ACTUAL_IMPL_DATE: false,
                CLIENT_REQST_SOL_DATE: false,
                AGRMT_END_DATE: false,
                PRPO_TARGET_DATE: false,
                IMPL_SGNOFF_DATE: false,
                TARGET_IMPL_DATE: false,
                ACC_MANAGER_OPI: false,
                AGR_OPI: false,
                BA_OPI: false,
                BA_PRICING_OPI: false,
                BA_PRICING_TL: false,
                BA_TL: false,
                CSM_DIRECTOR: false,
                EAOPI: false,
                PM_OPI: false,
                QA_OPI: false,
                SDM_TL_OPI: false,
                TEAMLEADER: false,
                WIO_OPI: false,
                PROD_OPI: false,
                CPLX_EN: false,
                CPLX_FR: false,
              },
            },
          }}
          pageSizeOptions={[5, 10]}
          checkboxSelection
          sx={{
            border: 0,
            backgroundColor: theme.palette.secondary.contrastText,
          }}
          showToolbar
        />
      </TableContainer>
    </Box>
  );
};

export default BusinessRequestTable;
