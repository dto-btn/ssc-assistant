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

interface BusinessRequestProps {
  data: BusinessRequest;
  lang: string;
}

const BusinessRequestCard: React.FC<BusinessRequestProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  return (
    <Box sx={{ maxWidth: 500, marginLeft: 5 }}>
      <Card variant="outlined">
        <CardContent>
          <Typography
            gutterBottom
            sx={{ color: "text.secondary", fontSize: 14 }}
          >
            Business Request #{data.BR_NMBR}
          </Typography>
          <Typography
            variant="h5"
            component="div"
            aria-description={data.BR_TITLE}
          >
            {data.BR_SHORT_TITLE}
          </Typography>
          <Typography variant="body2" color="textPrimary">
            <strong>Priority: </strong>
            {isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
          </Typography>
          <Typography variant="body2" color="textPrimary">
            <strong>Client Name: </strong>
            {data.CLIENT_NAME_SRC}
          </Typography>
          {isEnglish
            ? data.CLIENT_SUBGRP_EN
            : data.CLIENT_SUBGRP_FR && (
                <Typography variant="body2" color="textPrimary">
                  <strong>Client Subgroup: </strong>
                  {isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
                </Typography>
              )}
          <Typography variant="body2" color="textPrimary">
            <strong>Create Date: </strong>
            {new Date(data.CREATE_DATE).toLocaleDateString()}
          </Typography>
          <Typography variant="body2" color="textPrimary">
            <strong>Submit Date: </strong>
            {new Date(data.SUBMIT_DATE).toLocaleDateString()}
          </Typography>
          {data.ASSOC_BRS && (
            <Typography variant="body2" color="textPrimary">
              <strong>Associated Business Request(s): </strong>
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
              VIEW IN BITS
            </Button>
          </CardActions>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BusinessRequestCard;
