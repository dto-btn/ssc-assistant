import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Link,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { DateDisplay } from "./subcomponents/DateDisplay";

interface BusinessRequestProps {
  data: BusinessRequest;
  lang: string;
}

/**
 * Safely convert any value to a string for rendering.
 * Handles objects, arrays, and primitives without throwing React errors.
 */
const toDisplayValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => toDisplayValue(item)).join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const BusinessRequestCard: React.FC<BusinessRequestProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabIndex, setTabIndex] = React.useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };
  return (
    <Card
      variant="outlined"
      sx={{ backgroundColor: theme.palette.secondary.contrastText }}
    >
      <CardHeader
        title={data.BR_SHORT_TITLE}
        subheader={
          <Link
            id="BITS-PROD-link"
            href={`https://bitsprod.ssc-spc.gc.ca/BR/${data.BR_NMBR}`}
            rel="noopener"
            target="_blank"
          >
            BR # {data.BR_NMBR}
          </Link>
        }
      ></CardHeader>
      <CardContent>
        <Box sx={{ width: "100%" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tabIndex}
              onChange={handleTabChange}
              aria-label="BR tabs"
            >
              <Tab label={t("br.tab.1")} />
              <Tab label={t("br.tab.2")} />
              <Tab label={t("br.tab.3")} />
            </Tabs>
          </Box>
          {tabIndex === 0 && (
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>{t("LEAD_PRODUCT")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.LEAD_PRODUCT_EN : data.LEAD_PRODUCT_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("PRODUCTS")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.PRODUCTS_EN : data.PRODUCTS_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("br.type")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("status")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.BITS_STATUS_EN : data.BITS_STATUS_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("PHASE")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.PHASE_EN : data.PHASE_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("priority")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("client.name")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish
                      ? data.RPT_GC_ORG_NAME_EN
                      : data.RPT_GC_ORG_NAME_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("client.subgroup")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("complexity")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.CPLX_EN : data.CPLX_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("scope")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.SCOPE_EN : data.SCOPE_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("GCIT_PRIORITY")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.GCIT_PRIORITY_EN : data.GCIT_PRIORITY_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("GCIT_CAT")}</strong>
                  </TableCell>
                  <TableCell>
                    {toDisplayValue(isEnglish ? data.GCIT_CAT_EN : data.GCIT_CAT_FR)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("IO_ID")}</strong>
                  </TableCell>
                  <TableCell>{toDisplayValue(data.IO_ID)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("EPS_NMBR")}</strong>
                  </TableCell>
                  <TableCell>{toDisplayValue(data.EPS_NMBR)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("ECD_NMBR")}</strong>
                  </TableCell>
                  <TableCell>{toDisplayValue(data.ECD_NMBR)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("associated.business.requests")}</strong>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const safeBrs = toDisplayValue(data.ASSOC_BRS);
                      return (
                        data.ASSOC_BRS &&
                        typeof data.ASSOC_BRS === "string" &&
                        data.ASSOC_BRS.includes(",") ? (
                          data.ASSOC_BRS.split(",").map((br, index) => (
                            <React.Fragment key={index}>
                              <Link
                                className={`BITS-PROD-BR-${br.trim()}-link`}
                                href={`https://bitsprod.ssc-spc.gc.ca/BR/${br.trim()}`}
                                rel="noopener"
                                target="_blank"
                              >
                                {br.trim()}
                              </Link>
                              {index < data.ASSOC_BRS.split(",").length - 1 && ", "}
                            </React.Fragment>
                          ))
                        ) : (
                          <Link
                            className={`BITS-PROD-BR-${safeBrs}-link`}
                            href={`https://bitsprod.ssc-spc.gc.ca/BR/${safeBrs}`}
                            rel="noopener"
                            target="_blank"
                          >
                            {safeBrs}
                          </Link>
                        )
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {tabIndex === 1 && (
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>{t("submit.date")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.SUBMIT_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("REQST_IMPL_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.REQST_IMPL_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("RVSD_TARGET_IMPL_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.RVSD_TARGET_IMPL_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("ACTUAL_IMPL_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.ACTUAL_IMPL_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("AGRMT_END_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.AGRMT_END_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("TARGET_IMPL_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.TARGET_IMPL_DATE} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {tabIndex === 2 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>{t("role")}</strong>
                  </TableCell>
                  <TableCell>
                    <strong>{t("assignee")}</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{t("BR_OWNER")}</TableCell>
                  <TableCell>{toDisplayValue(data.BR_OWNER)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("ACC_MANAGER_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.ACC_MANAGER_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("AGR_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.AGR_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.BA_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_PRICING_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.BA_PRICING_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_PRICING_TL")}</TableCell>
                  <TableCell>{toDisplayValue(data.BA_PRICING_TL)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_TL")}</TableCell>
                  <TableCell>{toDisplayValue(data.BA_TL)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("CSM_DIRECTOR")}</TableCell>
                  <TableCell>{toDisplayValue(data.CSM_DIRECTOR)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("EAOPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.EAOPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("PM_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.PM_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("QA_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.QA_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("SDM_TL_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.SDM_TL_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("TEAMLEADER")}</TableCell>
                  <TableCell>{toDisplayValue(data.TEAMLEADER)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("WIO_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.WIO_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("PROD_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.PROD_OPI)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("SOLN_OPI")}</TableCell>
                  <TableCell>{toDisplayValue(data.SOLN_OPI)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Box>

        {/* <CardActions disableSpacing>
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </CardActions> */}
      </CardContent>
      {/* <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent></CardContent>
      </Collapse> */}
    </Card>
  );
};

export default BusinessRequestCard;
