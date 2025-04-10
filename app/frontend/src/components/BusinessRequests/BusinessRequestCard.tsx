import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Collapse,
  Link,
  styled,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import React from "react";
import { useTranslation } from "react-i18next";
import { DateDisplay } from "./subcomponents/DateDisplay";

interface BusinessRequestProps {
  data: BusinessRequest;
  lang: string;
}

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme }) => ({
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
  variants: [
    {
      props: ({ expand }) => !expand,
      style: {
        transform: "rotate(0deg)",
      },
    },
    {
      props: ({ expand }) => !!expand,
      style: {
        transform: "rotate(180deg)",
      },
    },
  ],
}));

const BusinessRequestCard: React.FC<BusinessRequestProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const theme = useTheme();
  const [tabIndex, setTabIndex] = React.useState(0);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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
                    {isEnglish ? data.LEAD_PRODUCT_EN : data.LEAD_PRODUCT_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("br.type")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("status")}: </strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.BITS_STATUS_EN : data.BITS_STATUS_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("priority")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("client.name")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish
                      ? data.RPT_GC_ORG_NAME_EN
                      : data.RPT_GC_ORG_NAME_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("client.subgroup")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("complexity")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.CPLX_EN : data.CPLX_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("scope")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.SCOPE_EN : data.SCOPE_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("GCIT_PRIORITY")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.GCIT_PRIORITY_EN : data.GCIT_PRIORITY_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("GCIT_CAT")}</strong>
                  </TableCell>
                  <TableCell>
                    {isEnglish ? data.GCIT_CAT_EN : data.GCIT_CAT_FR}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("associated.business.requests")}</strong>
                  </TableCell>
                  <TableCell>
                    {data.ASSOC_BRS &&
                    typeof data.ASSOC_BRS === "string" &&
                    data.ASSOC_BRS.includes(",") ? (
                      data.ASSOC_BRS.split(",").map((br, index) => (
                        <React.Fragment key={index}>
                          <Link
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
                        href={`https://bitsprod.ssc-spc.gc.ca/BR/${data.ASSOC_BRS}`}
                        rel="noopener"
                        target="_blank"
                      >
                        {data.ASSOC_BRS}
                      </Link>
                    )}
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
                    <strong>{t("CLIENT_REQST_SOL_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.CLIENT_REQST_SOL_DATE} />
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
                    <strong>{t("PRPO_TARGET_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.PRPO_TARGET_DATE} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>{t("IMPL_SGNOFF_DATE")}</strong>
                  </TableCell>
                  <TableCell>
                    <DateDisplay dateString={data.IMPL_SGNOFF_DATE} />
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
                  <TableCell>{data.BR_OWNER}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("ACC_MANAGER_OPI")}</TableCell>
                  <TableCell>{data.ACC_MANAGER_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("AGR_OPI")}</TableCell>
                  <TableCell>{data.AGR_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_OPI")}</TableCell>
                  <TableCell>{data.BA_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_PRICING_OPI")}</TableCell>
                  <TableCell>{data.BA_PRICING_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_PRICING_TL")}</TableCell>
                  <TableCell>{data.BA_PRICING_TL}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("BA_TL")}</TableCell>
                  <TableCell>{data.BA_TL}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("CSM_DIRECTOR")}</TableCell>
                  <TableCell>{data.CSM_DIRECTOR}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("EAOPI")}</TableCell>
                  <TableCell>{data.EAOPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("PM_OPI")}</TableCell>
                  <TableCell>{data.PM_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("QA_OPI")}</TableCell>
                  <TableCell>{data.QA_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("SDM_TL_OPI")}</TableCell>
                  <TableCell>{data.SDM_TL_OPI}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("TEAMLEADER")}</TableCell>
                  <TableCell>{data.TEAMLEADER}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("WIO_OPI")}</TableCell>
                  <TableCell>{data.WIO_OPI}</TableCell>
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
