import React, { useState } from "react";
import { Box, Link, Paper, TableContainer, useTheme, Modal, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { formatDate } from "./subcomponents/DateDisplay";
import BusinessRequestCard from "./BusinessRequestCard";
import { transformToBusinessRequest } from "../../util/bits_utils";

interface BusinessRequestTableProps {
  data: Array<BusinessRequest>;
  lang: string;
  show_fields: string[];
  brRequest?: BusinessRequest;
}

const BusinessRequestTable: React.FC<BusinessRequestTableProps> = ({
  data,
  lang,
  show_fields,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [brData, setBrData] = useState<BusinessRequest | undefined>(undefined);

  const handlePopupOpen = (BR: string) => {
    fetchBRData(BR)
      .then((data) => {
        const transformed = transformToBusinessRequest(data.br[0]);
        setBrData(transformed);
        setOpen(true);
      })
      .catch((error) => {
        console.error("Error fetching BR data:", error);
      });
  };

  const fetchBRData = async (BR: string) => {
    const response = await fetch("api/1.0/bits/br", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ br_numbers: [BR] }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result && Array.isArray(result) ? result[0] : result;
  };

  const handlePopupClose = () => {
    setOpen(false);
    setBrData(undefined);
  };

  const columns: GridColDef[] = [
    {
      field: "BR_NMBR",
      headerName: t("business.request.number.short"),
      width: 75,
      renderCell: (params) => (
        <Link onClick={() => handlePopupOpen(params.value)} style={{ cursor: "pointer" }}>
          #{params.value}
        </Link>
      ), 
    },
    {
      field: "BR_SHORT_TITLE",
      headerName: t("BR_SHORT_TITLE"),
      flex: 1,
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
      field: isEnglish ? "PRODUCTS_EN" : "PRODUCTS_FR",
      headerName: t("PRODUCTS"),
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
      field: "AGRMT_END_DATE",
      headerName: t("AGRMT_END_DATE"),
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
    { field: "SOLN_OPI", headerName: t("SOLN_OPI"), width: 150 },
    {
      field: isEnglish ? "CPLX_EN" : "CPLX_FR",
      headerName: t("complexity"),
      width: 150,
    },
    {
      field: isEnglish ? "GCIT_CAT_EN" : "GCIT_CAT_FR",
      headerName: t("GCIT_CAT"),
      width: 200,
    },
    {
      field: isEnglish ? "GCIT_PRIORITY_EN" : "GCIT_PRIORITY_FR",
      headerName: t("GCIT_PRIORITY"),
      width: 200,
    },
  ];

  // Build columnVisibilityModel based on select_fields
  const getColumnVisibilityModel = () => {
    // List all possible fields that are currently set to false by default
    const allFields = [
      "LEAD_PRODUCT_EN",
      "LEAD_PRODUCT_FR",
      "BR_TYPE_EN",
      "BR_TYPE_FR",
      "SCOPE_EN",
      "SCOPE_FR",
      "REQST_IMPL_DATE",
      "RVSD_TARGET_IMPL_DATE",
      "ACTUAL_IMPL_DATE",
      "AGRMT_END_DATE",
      "IMPL_SGNOFF_DATE",
      "TARGET_IMPL_DATE",
      "ACC_MANAGER_OPI",
      "AGR_OPI",
      "BA_OPI",
      "BA_PRICING_OPI",
      "BA_PRICING_TL",
      "BA_TL",
      "CSM_DIRECTOR",
      "EAOPI",
      "PM_OPI",
      "QA_OPI",
      "SDM_TL_OPI",
      "TEAMLEADER",
      "WIO_OPI",
      "PROD_OPI",
      "CPLX_EN",
      "CPLX_FR",
      "GCIT_CAT",
      "GCIT_PRIORITY",
      "SOLN_OPI",
      "GCIT_PRIORITY_EN",
      "GCIT_PRIORITY_FR",
      "BR_SHORT_TITLE",
      "PHASE_EN",
      "PHASE_FR",
      "PRIORITY_EN",
      "PRIORITY_FR",
      "BITS_STATUS_EN",
      "BITS_STATUS_FR",
      "GCIT_CAT_EN",
      "GCIT_CAT_FR",
      "RPT_GC_ORG_NAME_EN",
      "RPT_GC_ORG_NAME_FR",
      "BR_OWNER",
      "PRODUCTS_EN",
      "PRODUCTS_FR",
      "SUBMIT_DATE",
    ];

    const columnVisibilityModel: { [key: string]: boolean } = {};
    for (const field of allFields) {
      columnVisibilityModel[field] = !!(
        show_fields && show_fields.includes(field)
      );
    }
    return columnVisibilityModel;
  };

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
              page: 0,
              pageSize: 10,
            },
            columns: {
              columnVisibilityModel: getColumnVisibilityModel(),
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
      <Modal open={open} onClose={handlePopupClose}>
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            boxShadow: 24,
            p: 4,
            minWidth: 400, 
            maxWidth: "100%", // Make modal max width match parent
            width: "90vw",
            maxHeight: "95vh",
            overflowY: "auto",
            mx: "auto",
            my: "5vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            outline: "none",
            border: "1px solid " + theme.palette.divider,
          }}
        >
          {brData && (
            <BusinessRequestCard
              key={brData.BR_NMBR}
              data={brData}
              lang={lang}
            />
          )}
          <Box sx={{ mt: 2, width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handlePopupClose} color="primary" variant="contained">
              {t("close")}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default BusinessRequestTable;


