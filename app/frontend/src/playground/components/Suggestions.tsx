/**
 * Suggestions component
 *
 * Shows suggested prompts or auto-complete options for the user while
 * composing messages in the playground. Suggestions may be derived from
 * session history or model hints and are dispatched back to the store when
 * selected.
 */

import React, { useMemo } from "react";
import { Box, Typography, Grid, Card, CardContent, CardActionArea, Chip } from "@mui/material";
import { useTranslation } from 'react-i18next';
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EmailIcon from "@mui/icons-material/Email";
import PersonIcon from "@mui/icons-material/Person";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TopicIcon from "@mui/icons-material/Topic";

interface SuggestionCard {
  titleKey: string;
  tool: string;
  icon: JSX.Element;
  category: "general" | "br" | "geds" | "corporate" | "pmcoe";
  color: string;
}

interface Props {
  onSuggestionClicked: (text: string) => void;
  disabled?: boolean;
}

const Suggestions: React.FC<Props> = ({ onSuggestionClicked, disabled }) => {
  const { t } = useTranslation('playground');

  const allSuggestions: SuggestionCard[] = useMemo(() => [
    {
      titleKey: "suggestions.general.contact",
      tool: "geds",
      icon: <PersonIcon aria-hidden="true" sx={{ color: "#00695c" }} />,
      category: "geds",
      color: "#00695c", // Deep Teal (GEDS)
    },
    {
      titleKey: "suggestions.general.email",
      tool: "corporate",
      icon: <EmailIcon aria-hidden="true" sx={{ color: "#5c6bc0" }} />,
      category: "general",
      color: "#5c6bc0", // Indigo (General)
    },
    {
      titleKey: "suggestions.general.hire",
      tool: "corporate",
      icon: <HelpOutlineIcon aria-hidden="true" sx={{ color: "#1565c0" }} />,
      category: "corporate",
      color: "#1565c0", // Strong Blue (Corporate)
    },
    {
      titleKey: "suggestions.business.find",
      tool: "bits",
      icon: <ReceiptLongIcon aria-hidden="true" sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa", // Purple
    },
    {
      titleKey: "suggestions.business.pspc",
      tool: "bits",
      icon: <ReceiptLongIcon aria-hidden="true" sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa", // Purple
    },
    {
      titleKey: "suggestions.business.piechart",
      tool: "bits",
      icon: <ReceiptLongIcon aria-hidden="true" sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa", // Purple
    },
    ...Array.from({ length: 16 }, (_, i) => ({
      titleKey: `suggestions.pmcoe.q${i + 1}`,
      tool: "pmcoe",
      icon: <TopicIcon aria-hidden="true" sx={{ color: "#935d00" }} />,
      category: "pmcoe" as const,
      color: "#935d00", // Darker Gold (PMCOE)
    })),
  ], []);

  const shuffledSuggestions = useMemo(() => {
    const categories: ("geds" | "general" | "corporate" | "br" | "pmcoe")[] = ["geds", "general", "corporate", "br", "pmcoe"];
    const selection: SuggestionCard[] = [];
    const pool = [...allSuggestions];

    // Ensure at least one from each category if possible
    categories.forEach((cat) => {
      const catItems = pool.filter((item) => item.category === cat);
      if (catItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * catItems.length);
        const selectedItem = catItems[randomIndex];
        selection.push(selectedItem);
        // Remove from pool to avoid duplicates
        const indexInPool = pool.findIndex((item) => item === selectedItem);
        if (indexInPool > -1) pool.splice(indexInPool, 1);
      }
    });

    // Fill the rest with random items from the remaining pool
    while (selection.length < 6 && pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      selection.push(pool.splice(randomIndex, 1)[0]);
    }

    return selection.sort(() => 0.5 - Math.random());
  }, [allSuggestions]);

  return (
    <Box 
      sx={{ 
        width: "100%", 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        gap: { xs: 2, md: 3 }, 
        mb: { xs: 6, md: 10 },
        px: { xs: 2, sm: 3, md: 4 }
      }}
      aria-label={t("suggestions.aria_label", { defaultValue: "Suggested prompts" })}
    >
      <Grid container spacing={{ xs: 1.5, sm: 2 }} justifyContent="center" sx={{ maxWidth: "1200px" }}>
        {shuffledSuggestions.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index} sx={{ display: "flex" }}>
            <Card
              elevation={1}
              sx={{
                width: "100%",
                minHeight: { xs: "auto", sm: "160px" },
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardActionArea
                onClick={() => onSuggestionClicked(t(card.titleKey))}
                disabled={disabled}
                sx={{ 
                  height: "100%",
                  "&:focus-visible": {
                    outline: `2px solid ${card.color}`,
                    outlineOffset: "-2px",
                  }
                }}
                aria-label={t(card.titleKey)}
              >
                <CardContent
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    p: 2.5,
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    {card.icon}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        lineHeight: 1.4,
                        color: "text.primary",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {t(card.titleKey)}
                    </Typography>
                  </Box>
                  <Box sx={{ alignSelf: "flex-end" }}>
                    <Chip
                      label={t(`suggestions.categories.${card.category}`)}
                      size="small"
                      sx={{
                        backgroundColor: card.color,
                        color: "#fff",
                        fontWeight: "bold",
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Suggestions;