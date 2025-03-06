import React from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Link,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface BusinessRequestProps {
  data: BusinessRequest;
  lang: string;
}

const BusinessRequestCard: React.FC<BusinessRequestProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  return (
    <Box sx={{ maxWidth: 500, marginLeft: 5 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography
            gutterBottom
            sx={{ color: "text.secondary", fontSize: 14 }}
          >
            {t("business.request.number")}
            {data.BR_NMBR}
          </Typography>
          <Typography
            variant="h5"
            component="div"
            aria-description={data.BR_TITLE}
          >
            {data.BR_SHORT_TITLE}
          </Typography>
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
              <Link
                href={"https://bitsprod.ssc-spc.gc.ca/BR/" + data.ASSOC_BRS}
              >
                {data.ASSOC_BRS}
              </Link>
            </Typography>
          )}
          <CardActions>
            <Button
              size="small"
              href={"https://bitsprod.ssc-spc.gc.ca/BR/" + data.BR_NMBR}
            >
              {t("view.in.bits")}
            </Button>
          </CardActions>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BusinessRequestCard;
