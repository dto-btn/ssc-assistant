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

  const isInternalCitationUrl = (url: string): boolean => {
    return url.startsWith("local-citation://");
  };

  const getChipLabel = (group: GroupedCitation): string => {
    if (isInternalCitationUrl(group.url)) {
      if (group.title && group.title !== group.url) {
        return group.title;
      }
      return "local source reference";
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
              component={isInternalCitationUrl(group.url) ? "button" : "a"}
              href={isInternalCitationUrl(group.url) ? undefined : encodeURI(group.url)}
              target={isInternalCitationUrl(group.url) ? undefined : "_blank"}
              variant="filled"
              clickable
              color="primary"
              onClick={(event: React.MouseEvent<HTMLElement>) => {
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
