import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

interface BusinessRequestProps {
  data: BusinessRequest;
  lang: string;
}

const BusinessRequestCard: React.FC<BusinessRequestProps> = ({ data, lang }) => {
  const isEnglish = lang === 'en';

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="div">
          {data.BR_TITLE}
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          {data.BR_SHORT_TITLE}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>BR Number: </strong>{data.BR_NMBR}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>Priority: </strong>{isEnglish ? data.PRIORITY_EN : data.PRIORITY_FR}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>Client Name: </strong>{data.CLIENT_NAME_SRC}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>Client Subgroup: </strong>{isEnglish ? data.CLIENT_SUBGRP_EN : data.CLIENT_SUBGRP_FR}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>Create Date: </strong>{new Date(data.CREATE_DATE).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          <strong>Submit Date: </strong>{new Date(data.SUBMIT_DATE).toLocaleDateString()}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default BusinessRequestCard;