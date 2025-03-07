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
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';

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
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
  variants: [
    {
      props: ({ expand }) => !expand,
      style: {
        transform: 'rotate(0deg)',
      },
    },
    {
      props: ({ expand }) => !!expand,
      style: {
        transform: 'rotate(180deg)',
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
    <Card variant="outlined" sx={{ backgroundColor: theme.palette.secondary.contrastText}}>
      <CardHeader 
          // avatar={
          //   <Avatar sx={{ bgcolor: red[500] }} aria-label="BR #" variant="square">
          //     #
          //   </Avatar>}
          title={data.BR_SHORT_TITLE}
          subheader={<Link
            href={`https://bitsprod.ssc-spc.gc.ca/BR/${data.BR_NMBR}`}
            rel="noopener"
            target="_blank"
          >
            BR # {data.BR_NMBR}
          </Link>}
        >
      </CardHeader>
      <CardContent>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("priority")}: </strong>
          {isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("client.name")}: </strong>
          {data.CLIENT_NAME_SRC}
        </Typography>
        {isEnglish
          ? data.CLIENT_SUBGRP_EN
          : data.CLIENT_SUBGRP_FR && (
              <Typography variant="body2" color="textPrimary">
                <strong>{t("client.subgroup")}: </strong>
                {isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
              </Typography>
            )}
        <Typography variant="body2" color="textPrimary">
          <strong>{t("create.date")}: </strong>
          {new Date(data.CREATE_DATE).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="textPrimary">
          <strong>{t("submit.date")}: </strong>
          {new Date(data.SUBMIT_DATE).toLocaleDateString()}
        </Typography>
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

        <Divider sx={{ marginTop: 2, marginBottom: 2}}/>
        {data.BR_OWNER && (
          <Typography variant="body2">
            <strong>{t("br.owner")}: </strong>
            {data.BR_OWNER}
          </Typography>
        )}

        {data.BR_INITR && (
          <Typography variant="body2">
            <strong>{t("br.initr")}: </strong>
            {data.BR_INITR}
          </Typography>
        )}

        {data.BR_LAST_EDITOR && (
          <Typography variant="body2">
            <strong>{t("br.last_editor")}: </strong>
            {data.BR_LAST_EDITOR}
          </Typography>
        )}

        {data.CSM_OPI && (
          <Typography variant="body2">
            <strong>{t("csm.opi")}: </strong>
            {data.CSM_OPI}
          </Typography>
        )}

        {data.TL_OPI && (
          <Typography variant="body2">
            <strong>{t("tl.opi")}: </strong>
            {data.TL_OPI}
          </Typography>
        )}

        {data.CSM_DIRTR && (
          <Typography variant="body2">
            <strong>{t("csm.dirtr")}: </strong>
            {data.CSM_DIRTR}
          </Typography>
        )}

        {data.SOL_OPI && (
          <Typography variant="body2">
            <strong>{t("sol.opi")}: </strong>
            {data.SOL_OPI}
          </Typography>
        )}

        {data.ENGN_OPI && (
          <Typography variant="body2">
            <strong>{t("engn.opi")}: </strong>
            {data.ENGN_OPI}
          </Typography>
        )}

        {data.BA_OPI && (
          <Typography variant="body2">
            <strong>{t("ba.opi")}: </strong>
            {data.BA_OPI}
          </Typography>
        )}

        {data.BA_TL && (
          <Typography variant="body2">
            <strong>{t("ba.tl")}: </strong>
            {data.BA_TL}
          </Typography>
        )}

        {data.PM_OPI && (
          <Typography variant="body2">
            <strong>{t("pm.opi")}: </strong>
            {data.PM_OPI}
          </Typography>
        )}

        {data.BA_PRICE_OPI && (
          <Typography variant="body2">
            <strong>{t("ba.price_opi")}: </strong>
            {data.BA_PRICE_OPI}
          </Typography>
        )}

        {data.QA_OPI && (
          <Typography variant="body2">
            <strong>{t("qa.opi")}: </strong>
            {data.QA_OPI}
          </Typography>
        )}

        {data.SL_COORD && (
          <Typography variant="body2">
            <strong>{t("sl.coord")}: </strong>
            {data.SL_COORD}
          </Typography>
        )}

        {data.AGRMT_OPI && (
          <Typography variant="body2">
            <strong>{t("agrmt.opi")}: </strong>
            {data.AGRMT_OPI}
          </Typography>
        )}

        {data.ACCT_MGR_OPI && (
          <Typography variant="body2">
            <strong>{t("acct_mgr.opi")}: </strong>
            {data.ACCT_MGR_OPI}
          </Typography>
        )}

        {data.SDM_TL_OPI && (
          <Typography variant="body2">
            <strong>{t("sdm.tl_opi")}: </strong>
            {data.SDM_TL_OPI}
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
          <Typography variant="body2" sx={{ marginBottom: 2 }}><strong>{t("long.title")}: </strong></Typography>
              <Typography variant="body2" sx={{ marginBottom: 2 }}>
              {data.BR_TITLE}
              </Typography>
          {data.REQMT_OVRVW && (
            <>
              <Typography variant="body2" sx={{ marginBottom: 2 }}><strong>{t("reqmt.ovrvw")}: </strong></Typography>
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
