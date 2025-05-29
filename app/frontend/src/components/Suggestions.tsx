import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
} from "@mui/material";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EmailIcon from "@mui/icons-material/Email";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslation } from "react-i18next";

type SuggestionsProps = {
  onSuggestionClicked: (suggestion: string, tool: string) => void;
};

// Card type definitions with color and category info
interface SuggestionCard {
  title: string;
  tool: string;
  icon: JSX.Element;
  category: "general" | "br";
  color: string;
}

const Suggestions = ({ onSuggestionClicked }: SuggestionsProps) => {
  const { t } = useTranslation();

  // Define all suggestion cards with their properties
  const suggestionCards: SuggestionCard[] = [
    {
      title: t("suggestions.general.email"),
      tool: "corporate",
      icon: <EmailIcon sx={{ color: "#3f51b5" }} />, // Blue
      category: "general",
      color: "#3f51b5",
    },
    {
      title: t("suggestions.general.hire"),
      tool: "corporate",
      icon: <HelpOutlineIcon sx={{ color: "#8e24aa" }} />, // Purple
      category: "general",
      color: "#8e24aa",
    },
    {
      title: t("suggestions.business.find"),
      tool: "bits",
      icon: <ReceiptIcon sx={{ color: "#4caf50" }} />, // Green
      category: "br",
      color: "#4caf50",
    },
    {
      title: t("suggestions.business.pspc"),
      tool: "bits",
      icon: <ReceiptIcon sx={{ color: "#3f51b5" }} />, // Blue
      category: "br",
      color: "#3f51b5",
    },
    {
      title: t("suggestions.business.piechart"),
      tool: "bits",
      icon: <ReceiptIcon sx={{ color: "#8e24aa" }} />, // Purple
      category: "br",
      color: "#8e24aa",
    },
  ];

  return (
    <Box sx={{ width: "100%", mb: 3 }}>
      <Grid container spacing={2} justifyContent="center">
        {suggestionCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              elevation={1}
              sx={{
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
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    {card.icon}
                    <Typography variant="body1">{card.title}</Typography>
                  </Box>
                  <Box sx={{ alignSelf: "flex-end", mt: 1 }}>
                    <Chip
                      label={
                        card.category === "general"
                          ? "General"
                          : "Business Request"
                      }
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
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Suggestions;
