import React from "react";
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Collapse,
  Link,
  styled,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";

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

  const handleExpandClick = () => {
    setExpanded(!expanded);
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
        {data.SR_OWNER && (
          <Typography variant="body2">
            <strong>{t("SR_OWNER")}: </strong>
            {data.SR_OWNER}
          </Typography>
        )}
        {(isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR) && (
          <Typography variant="body2">
            <strong>{t("br.type")}: </strong>
            {isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR}
          </Typography>
        )}
        {(isEnglish ? data.BITS_STATUS_EN : data.BITS_STATUS_FR) && (
          <Typography variant="body2">
            <strong>{t("status")}: </strong>
            {isEnglish ? data.BITS_STATUS_EN : data.BITS_STATUS_FR}
          </Typography>
        )}
        <Typography variant="body2" color="textPrimary">
          <strong>{t("priority")}: </strong>
          {isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("client.name")}: </strong>
          {isEnglish ? data.RPT_GC_ORG_NAME_EN : data.RPT_GC_ORG_NAME_FR}
        </Typography>
        {(isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR) && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("client.subgroup")}: </strong>
            {isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
          </Typography>
        )}
        {(isEnglish ? data.CPLX_EN : data.CPLX_FR) && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("complexity")}: </strong>
            {isEnglish ? data.CPLX_EN : data.CPLX_FR}
          </Typography>
        )}
        {(isEnglish ? data.SCOPE_EN : data.SCOPE_FR) && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("scope")}: </strong>
            {isEnglish ? data.SCOPE_EN : data.SCOPE_FR}
          </Typography>
        )}
        <Typography variant="body2" color="textPrimary">
          <strong>{t("submit.date")}: </strong>
          {new Date(data.SUBMIT_DATE).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("REQST_IMPL_DATE")}: </strong>
          {new Date(data.REQST_IMPL_DATE).toLocaleDateString()}
        </Typography>
        {data.RVSD_TARGET_IMPL_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("RVSD_TARGET_IMPL_DATE")}: </strong>
            {new Date(data.RVSD_TARGET_IMPL_DATE).toLocaleDateString()}
          </Typography>
        )}
        {data.ACTUAL_IMPL_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("ACTUAL_IMPL_DATE")}: </strong>
            {new Date(data.ACTUAL_IMPL_DATE).toLocaleDateString()}
          </Typography>
        )}

        {data.CLIENT_REQST_SOL_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("CLIENT_REQST_SOL_DATE")}: </strong>
            {new Date(data.CLIENT_REQST_SOL_DATE).toLocaleDateString()}
          </Typography>
        )}

        {data.AGRMT_END_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("AGRMT_END_DATE")}: </strong>
            {new Date(data.AGRMT_END_DATE).toLocaleDateString()}
          </Typography>
        )}

        {data.PRPO_TARGET_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("PRPO_TARGET_DATE")}: </strong>
            {new Date(data.PRPO_TARGET_DATE).toLocaleDateString()}
          </Typography>
        )}

        {data.IMPL_SGNOFF_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("IMPL_SGNOFF_DATE")}: </strong>
            {new Date(data.IMPL_SGNOFF_DATE).toLocaleDateString()}
          </Typography>
        )}

        {data.ASSOC_BRS && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("associated.business.requests")}: </strong>
            {typeof data.ASSOC_BRS === "string" &&
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
          </Typography>
        )}

        <CardActions disableSpacing>
          {/* <Button
            size="small"
            href={"https://bitsprod.ssc-spc.gc.ca/BR/" + data.BR_NMBR}
          >
            {t("view.in.bits")}
          </Button> */}
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </CardActions>
      </CardContent>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent>
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
              {data.ACC_MANAGER_OPI && (
                <TableRow>
                  <TableCell>{t("ACC_MANAGER_OPI")}</TableCell>
                  <TableCell>{data.ACC_MANAGER_OPI}</TableCell>
                </TableRow>
              )}
              {data.AGR_OPI && (
                <TableRow>
                  <TableCell>{t("AGR_OPI")}</TableCell>
                  <TableCell>{data.AGR_OPI}</TableCell>
                </TableRow>
              )}
              {data.BA_OPI && (
                <TableRow>
                  <TableCell>{t("BA_OPI")}</TableCell>
                  <TableCell>{data.BA_OPI}</TableCell>
                </TableRow>
              )}
              {data.BA_PRICING_OPI && (
                <TableRow>
                  <TableCell>{t("BA_PRICING_OPI")}</TableCell>
                  <TableCell>{data.BA_PRICING_OPI}</TableCell>
                </TableRow>
              )}
              {data.BA_PRICING_TL && (
                <TableRow>
                  <TableCell>{t("BA_PRICING_TL")}</TableCell>
                  <TableCell>{data.BA_PRICING_TL}</TableCell>
                </TableRow>
              )}
              {data.BA_TL && (
                <TableRow>
                  <TableCell>{t("BA_TL")}</TableCell>
                  <TableCell>{data.BA_TL}</TableCell>
                </TableRow>
              )}
              {data.CSM_DIRECTOR && (
                <TableRow>
                  <TableCell>{t("CSM_DIRECTOR")}</TableCell>
                  <TableCell>{data.CSM_DIRECTOR}</TableCell>
                </TableRow>
              )}
              {data.EAOPI && (
                <TableRow>
                  <TableCell>{t("EAOPI")}</TableCell>
                  <TableCell>{data.EAOPI}</TableCell>
                </TableRow>
              )}
              {data.PM_OPI && (
                <TableRow>
                  <TableCell>{t("PM_OPI")}</TableCell>
                  <TableCell>{data.PM_OPI}</TableCell>
                </TableRow>
              )}
              {data.QA_OPI && (
                <TableRow>
                  <TableCell>{t("QA_OPI")}</TableCell>
                  <TableCell>{data.QA_OPI}</TableCell>
                </TableRow>
              )}
              {data.SDM_TL_OPI && (
                <TableRow>
                  <TableCell>{t("SDM_TL_OPI")}</TableCell>
                  <TableCell>{data.SDM_TL_OPI}</TableCell>
                </TableRow>
              )}
              {data.SR_OWNER && (
                <TableRow>
                  <TableCell>{t("SR_OWNER")}</TableCell>
                  <TableCell>{data.SR_OWNER}</TableCell>
                </TableRow>
              )}
              {data.TEAMLEADER && (
                <TableRow>
                  <TableCell>{t("TEAMLEADER")}</TableCell>
                  <TableCell>{data.TEAMLEADER}</TableCell>
                </TableRow>
              )}
              {data.WIO_OPI && (
                <TableRow>
                  <TableCell>{t("WIO_OPI")}</TableCell>
                  <TableCell>{data.WIO_OPI}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default BusinessRequestCard;
