import React, { useMemo, useState } from "react";
import { Box, Link, Paper, TableContainer, Typography, useTheme, Modal, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { formatDate } from "../../components/BusinessRequests/subcomponents/DateDisplay";
import BusinessRequestCard from "../../components/BusinessRequests/BusinessRequestCard";
import { transformToBusinessRequest } from "../../util/bits_utils";
import { toDisplayValue } from "../../utils/displayValue";

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

  const normalizedRows = useMemo(() => {
    return data.map((row) => {
      const normalizedRow: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        // Preserve nulls so DataGrid can treat empty values as blank cells.
        normalizedRow[key] = toDisplayValue(value, { nullValue: null });
      });
      return normalizedRow as unknown as BusinessRequest;
    });
  }, [data]);

  const handlePopupOpen = (BR: string) => {
    fetchBRData(BR)
      .then((fetchedData) => {
        const transformed = transformToBusinessRequest(fetchedData.br[0]);
        setBrData(transformed);
        setOpen(true);
      })
      .catch((error) => {
        console.error("Error fetching BR data:", error);
      });
  };

  const fetchBRData = async (BR: string) => {
    // Accept UI-facing BR variants (e.g. "BR-1234", "#1234") but call the API with digits only.
    const normalizedBr = String(BR).trim().replace(/^#?BR[-\s]?/i, "");
    if (!/^\d+$/.test(normalizedBr)) {
      throw new Error("BR must be all numbers.");
    }
    const response = await fetch(`api/1.0/bits/br/${encodeURIComponent(normalizedBr)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result;
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
        <Link
          className="br-table-link"
          component="button"
          type="button"
          aria-label={t("br.open.details", { br: params.value })}
          onClick={(event) => {
            event.stopPropagation();
            handlePopupOpen(params.value);
          }}
          sx={{ cursor: "pointer", background: "none", border: 0, p: 0 }}
        >
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

  const paginationModel = useMemo(() => ({ page: 0, pageSize: 10 }), []);
  const fallbackVisibleFields = useMemo(() => [
    "BR_NMBR",
    "BR_SHORT_TITLE",
    isEnglish ? "RPT_GC_ORG_NAME_EN" : "RPT_GC_ORG_NAME_FR",
    "BR_OWNER",
    isEnglish ? "BITS_STATUS_EN" : "BITS_STATUS_FR",
    isEnglish ? "PRIORITY_EN" : "PRIORITY_FR",
    "SUBMIT_DATE",
  ], [isEnglish]);
  const requestedFields = useMemo(
    () => Array.isArray(show_fields) ? show_fields.filter((field) => typeof field === "string") : [],
    [show_fields]
  );

  const columnVisibilityModel = useMemo(() => {
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
    // Honor server-selected fields first, then fall back to a curated compact default set.
    const fieldsToShow = requestedFields.length > 0 ? requestedFields : fallbackVisibleFields;
    for (const field of allFields) {
      columnVisibilityModel[field] = fieldsToShow.includes(field);
    }
    return columnVisibilityModel;
  }, [requestedFields, fallbackVisibleFields]);

  return (
    <Box>
      <TableContainer
        component={Paper}
        sx={{ backgroundColor: theme.palette.secondary.contrastText, minHeight: 420 }}
      >
        <DataGrid
          rows={normalizedRows}
          columns={columns}
          getRowId={(row) => row.BR_NMBR ?? `${row.BR_SHORT_TITLE ?? "row"}-${row.SUBMIT_DATE ?? ""}`}
          autoHeight
          initialState={{
            pagination: {
              paginationModel,
            },
            columns: {
              columnVisibilityModel: columnVisibilityModel,
            },
          }}
          pageSizeOptions={[5, 10]}
          checkboxSelection
          sx={{
            border: 0,
            backgroundColor: theme.palette.secondary.contrastText,
          }}
          showToolbar
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
              csvOptions: { fileName: "business-requests", utf8WithBom: true },
            },
          }}
        />
      </TableContainer>
      <Modal
        open={open}
        onClose={handlePopupClose}
        aria-labelledby="br-modal-title"
        aria-describedby="br-modal-content"
      >
        <Box
          role="dialog"
          aria-modal="true"
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            boxShadow: 24,
            p: 4,
            minWidth: "min(400px, 90vw)",
            maxWidth: 600,
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
          <Typography
            id="br-modal-title"
            variant="h6"
            component="h2"
            sx={{ width: "100%", mb: 1 }}
          >
            {t("br.modal.title")}
          </Typography>
          {brData && (
            <Box id="br-modal-content" sx={{ width: "100%", overflow: "auto", maxHeight: "70vh" }}>
              <BusinessRequestCard
                key={brData.BR_NMBR}
                data={brData}
                lang={lang}
              />
            </Box>
          )}
          <Box sx={{ mt: 2, width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <Button id="close-br-table-button" onClick={handlePopupClose} color="primary" variant="contained">
              {t("close")}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default BusinessRequestTable;
