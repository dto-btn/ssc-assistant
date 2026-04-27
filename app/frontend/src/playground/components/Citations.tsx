import React from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { GroupedCitation } from "../utils/citations";

interface Props {
  groupedCitations: GroupedCitation[];
  onCitationClick: (citation: GroupedCitation) => void;
}

/**
 * Render grouped citation chips beneath an assistant message.
 */
const Citations: React.FC<Props> = ({ groupedCitations, onCitationClick }) => {
  const { t } = useTranslation("playground");

  const isInternalCitationUrl = (url: string): boolean => {
    return url.startsWith("local-citation://");
  };

  const getChipLabel = (group: GroupedCitation): string => {
    if (isInternalCitationUrl(group.url)) {
      if (group.title && group.title !== group.url) {
        return group.title;
      }
      return t("citations.localSourceReference", {
        defaultValue: "Local source reference",
      });
    }
    return group.title;
  };

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
              label={getChipLabel(group)}
              component="button"
              type="button"
              variant="filled"
              clickable
              color="primary"
              aria-label={t("citations.chip.open", {
                defaultValue: "Open citation details for {{title}}",
                title: getChipLabel(group),
              })}
              aria-haspopup="dialog"
              aria-controls="citation-drawer"
              onClick={() => {
                onCitationClick(group);
              }}
              sx={{
                height: "auto",
                maxWidth: "100%",
                alignItems: "flex-start",
                textAlign: "left",
                "& .MuiChip-label": {
                  display: "block",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  py: 0.75,
                },
              }}
            />
          ))}
        </Stack>
      </Box>
    </>
  );
};

export default Citations;
