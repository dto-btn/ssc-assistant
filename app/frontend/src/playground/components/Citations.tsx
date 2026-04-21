import React from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { GroupedCitation } from "../utils/citations";

interface Props {
  groupedCitations: GroupedCitation[];
  onCitationClick: (citation: GroupedCitation) => void;
}

const Citations: React.FC<Props> = ({ groupedCitations, onCitationClick }) => {
  const { t } = useTranslation("playground");

  if (!groupedCitations || groupedCitations.length === 0) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box sx={{ m: 2, maxWidth: "100%" }}>
        <Typography gutterBottom variant="subtitle2">
          {t("citations.label", { defaultValue: "Citation(s):" })}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {groupedCitations.map((group, index) => (
            <Chip
              id={`citation-chip-${index}`}
              key={`${group.url}-${index}`}
              label={group.title}
              component="a"
              href={encodeURI(group.url)}
              target="_blank"
              variant="filled"
              clickable
              color="primary"
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.button === 1) {
                  return;
                }

                event.preventDefault();
                onCitationClick(group);
              }}
            />
          ))}
        </Stack>
      </Box>
    </>
  );
};

export default Citations;
