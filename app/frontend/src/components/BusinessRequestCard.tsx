import React from "react";
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Collapse,
  Divider,
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
        // avatar={
        //   <Avatar sx={{ bgcolor: red[500] }} aria-label="BR #" variant="square">
        //     #
        //   </Avatar>}
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
        {(isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR) && (
          <Typography variant="body2">
            <strong>{t("br.type")}: </strong>
            {isEnglish ? data.BR_TYPE_EN : data.BR_TYPE_FR}
          </Typography>
        )}
        <Typography variant="body2" color="textPrimary">
          <strong>{t("priority")}: </strong>
          {isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("client.name")}: </strong>
          {data.CLIENT_NAME_SRC}
        </Typography>
        {(isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR) && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("client.subgroup")}: </strong>
            {isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
          </Typography>
        )}
        {/* <Typography variant="body2" color="textPrimary">
          <strong>{t("create.date")}: </strong>
          {new Date(data.CREATE_DATE).toLocaleDateString()}
        </Typography> */}
        <Typography variant="body2" color="textPrimary">
          <strong>{t("submit.date")}: </strong>
          {new Date(data.SUBMIT_DATE).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("client.request.impl.date")}: </strong>
          {new Date(data.REQST_IMPL_DATE).toLocaleDateString()}
        </Typography>
        {data.RVSD_TARGET_IMPL_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("revised.impl.date")}: </strong>
            {new Date(data.RVSD_TARGET_IMPL_DATE).toLocaleDateString()}
          </Typography>
        )}
        {data.ACTUAL_IMPL_DATE && (
          <Typography variant="body2" color="textPrimary">
            <strong>{t("actual.impl.date")}: </strong>
            {new Date(data.ACTUAL_IMPL_DATE).toLocaleDateString()}
          </Typography>
        )}
        {(isEnglish ? data.CANCEL_REASON_EN : data.CANCEL_REASON_FR) && (
          <Typography variant="body2">
            <strong>{t("cancel.reason")}: </strong>
            {isEnglish ? data.CANCEL_REASON_EN : data.CANCEL_REASON_FR}
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

        <Divider sx={{ marginTop: 2, marginBottom: 2 }} />
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
            {data.BR_OWNER && (
              <TableRow>
                <TableCell>{t("br.owner")}</TableCell>
                <TableCell>{data.BR_OWNER}</TableCell>
              </TableRow>
            )}
            {data.BR_INITR && (
              <TableRow>
                <TableCell>{t("br.initr")}</TableCell>
                <TableCell>{data.BR_INITR}</TableCell>
              </TableRow>
            )}
            {data.BR_LAST_EDITOR && (
              <TableRow>
                <TableCell>{t("br.last_editor")}</TableCell>
                <TableCell>{data.BR_LAST_EDITOR}</TableCell>
              </TableRow>
            )}
            {data.CSM_OPI && (
              <TableRow>
                <TableCell>{t("csm.opi")}</TableCell>
                <TableCell>{data.CSM_OPI}</TableCell>
              </TableRow>
            )}
            {data.TL_OPI && (
              <TableRow>
                <TableCell>{t("tl.opi")}</TableCell>
                <TableCell>{data.TL_OPI}</TableCell>
              </TableRow>
            )}
            {data.CSM_DIRTR && (
              <TableRow>
                <TableCell>{t("csm.dirtr")}</TableCell>
                <TableCell>{data.CSM_DIRTR}</TableCell>
              </TableRow>
            )}
            {data.SOL_OPI && (
              <TableRow>
                <TableCell>{t("sol.opi")}</TableCell>
                <TableCell>{data.SOL_OPI}</TableCell>
              </TableRow>
            )}
            {data.ENGN_OPI && (
              <TableRow>
                <TableCell>{t("engn.opi")}</TableCell>
                <TableCell>{data.ENGN_OPI}</TableCell>
              </TableRow>
            )}
            {data.BA_OPI && (
              <TableRow>
                <TableCell>{t("ba.opi")}</TableCell>
                <TableCell>{data.BA_OPI}</TableCell>
              </TableRow>
            )}
            {data.BA_TL && (
              <TableRow>
                <TableCell>{t("ba.tl")}</TableCell>
                <TableCell>{data.BA_TL}</TableCell>
              </TableRow>
            )}
            {data.PM_OPI && (
              <TableRow>
                <TableCell>{t("pm.opi")}</TableCell>
                <TableCell>{data.PM_OPI}</TableCell>
              </TableRow>
            )}
            {data.BA_PRICE_OPI && (
              <TableRow>
                <TableCell>{t("ba.price_opi")}</TableCell>
                <TableCell>{data.BA_PRICE_OPI}</TableCell>
              </TableRow>
            )}
            {data.QA_OPI && (
              <TableRow>
                <TableCell>{t("qa.opi")}</TableCell>
                <TableCell>{data.QA_OPI}</TableCell>
              </TableRow>
            )}
            {data.SL_COORD && (
              <TableRow>
                <TableCell>{t("sl.coord")}</TableCell>
                <TableCell>{data.SL_COORD}</TableCell>
              </TableRow>
            )}
            {data.AGRMT_OPI && (
              <TableRow>
                <TableCell>{t("agrmt.opi")}</TableCell>
                <TableCell>{data.AGRMT_OPI}</TableCell>
              </TableRow>
            )}
            {data.ACCT_MGR_OPI && (
              <TableRow>
                <TableCell>{t("acct_mgr.opi")}</TableCell>
                <TableCell>{data.ACCT_MGR_OPI}</TableCell>
              </TableRow>
            )}
            {data.SDM_TL_OPI && (
              <TableRow>
                <TableCell>{t("sdm.tl_opi")}</TableCell>
                <TableCell>{data.SDM_TL_OPI}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
          <Typography variant="body2" sx={{ marginBottom: 2 }}>
            <strong>{t("long.title")}: </strong>
          </Typography>
          <Typography variant="body2" sx={{ marginBottom: 2 }}>
            {data.BR_TITLE}
          </Typography>
          {data.REQMT_OVRVW && (
            <>
              <Typography variant="body2" sx={{ marginBottom: 2 }}>
                <strong>{t("reqmt.ovrvw")}: </strong>
              </Typography>
              <Typography variant="body2" sx={{ marginBottom: 2 }}>
                {data.REQMT_OVRVW}
              </Typography>
            </>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default BusinessRequestCard;
