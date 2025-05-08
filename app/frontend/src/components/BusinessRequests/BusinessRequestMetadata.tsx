import { Typography, Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatDate } from "./subcomponents/DateDisplay";

interface BrMetadata {
  execution_time: number;
  results: number;
  total_rows: number;
  extraction_date: string;
}

interface BusinessRequestMetadataProps {
  metadata: BrMetadata;
}

const BusinessRequestMetadata: React.FC<BusinessRequestMetadataProps> = ({
  metadata,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Typography variant="caption">
        {t("br.metadata.showing", {
          results: metadata.results,
          total: metadata.total_rows,
          time: metadata.execution_time.toFixed(2),
        })}
      </Typography>
      <Typography variant="caption">
        {" "}
        Extraction: {formatDate(metadata.extraction_date)}
      </Typography>
    </Box>
  );
};

export default BusinessRequestMetadata;
