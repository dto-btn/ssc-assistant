import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EmailIcon from "@mui/icons-material/Email";
import PersonIcon from "@mui/icons-material/Person";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslation } from "react-i18next";
import { allowedToolsSet } from "../allowedTools";

type SuggestionsProps = {
  onSuggestionClicked: (suggestion: string, tool: string) => void;
  tools?: string[]; //if specified only display cards for those tools
};

// Card type definitions with color and category info
interface SuggestionCard {
  title: string;
  tool: string;
  icon: JSX.Element;
  category: "general" | "br" | "geds" | "corporate";
  color: string;
}

const Suggestions = ({ onSuggestionClicked, tools = [] }: SuggestionsProps) => {
  const { t } = useTranslation();

  // Define all suggestion cards with their properties
  const suggestionCards: SuggestionCard[] = [
    {
      title: t("suggestions.general.contact"),
      tool: "geds",
      icon: <PersonIcon sx={{ color: "#3f51b5" }} />,
      category: "geds",
      color: "#3f51b5",
    },
    {
      title: t("suggestions.general.email"),
      tool: "corporate",
      icon: <EmailIcon sx={{ color: "#3f51b5" }} />,
      category: "general",
      color: "#3f51b5",
    },
    {
      title: t("suggestions.general.hire"),
      tool: "corporate",
      icon: <HelpOutlineIcon sx={{ color: "#3f51b5" }} />,
      category: "corporate",
      color: "#3f51b5",
    },
    {
      title: t("suggestions.business.find"),
      tool: "bits",
      icon: <ReceiptLongIcon sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa",
    },
    {
      title: t("suggestions.business.pspc"),
      tool: "bits",
      icon: <ReceiptLongIcon sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa",
    },
    {
      title: t("suggestions.business.piechart"),
      tool: "bits",
      icon: <ReceiptLongIcon sx={{ color: "#8e24aa" }} />,
      category: "br",
      color: "#8e24aa",
    },
  ];

  // Filter suggestion cards based on the allowedToolsSet
  const filteredSuggestionCards = suggestionCards.filter(
    (card) =>
      allowedToolsSet.has(card.tool) &&
      (!tools || tools.length === 0 || tools.includes(card.tool))
  );

  return (
    <Box sx={{ width: "100%", mb: 3 }}>
      {/* Using a fixed grid with equal column width and fixed card dimensions */}
      <Grid
        container
        spacing={2}
        justifyContent="center"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr", // 1 column on mobile
            sm: "repeat(2, 1fr)", // 2 columns on tablets
            md: "repeat(3, 1fr)", // 3 columns on desktop
          },
          gap: 2,
        }}
      >
        {filteredSuggestionCards.map((card, index) => (
          <Card
            key={index}
            elevation={1}
            sx={{
              height: "150px", // Fixed card height
              width: "100%", // Full width of grid cell
              borderLeft: `4px solid ${card.color}`,
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-5px)",
                boxShadow: 3,
              },
            }}
          >
            <CardActionArea
              onClick={() => onSuggestionClicked(card.title, card.tool)}
              sx={{ height: "100%" }}
            >
              <CardContent
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: 2,
                  overflowY: "hidden", // Only prevent vertical overflow
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    width: "100%",
                  }}
                >
                  {card.icon}
                  <Typography
                    variant="body1"
                    sx={{
                      // Allow full text display horizontally
                      width: "100%",
                    }}
                  >
                    {card.title}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: "flex-end", mt: 2 }}>
                  <Chip
                    label={t(`suggestions.categories.${card.category}`)}
                    size="small"
                    sx={{
                      backgroundColor: `${card.color}20`,
                      color: card.color,
                      fontWeight: "medium",
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Grid>
    </Box>
  );
};

export default Suggestions;
