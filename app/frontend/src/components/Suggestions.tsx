import {
  Box,
  Grid,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EmailIcon from "@mui/icons-material/Email";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslation } from "react-i18next";

type SuggestionsProps = {
  onSuggestionClicked: (suggestionText: string) => void;
};

const Suggestions = ({ onSuggestionClicked }: SuggestionsProps) => {
  const { t } = useTranslation();

  const sendMessage = (question: string) => {
    onSuggestionClicked(question);
  };

  return (
    <Box sx={{ width: "100%", mb: 3 }}>
      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={5}>
          <Box
            sx={{
              backgroundColor: "primary.light",
              borderRadius: 2,
              p: 3,
              height: "100%",
              boxShadow: 3,
              transition: "transform 0.3s, box-shadow 0.3s",
              "&:hover": {
                transform: "translateY(-5px)",
                boxShadow: 6,
              },
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              align="center"
              color="common.white"
              sx={{ mb: 2, fontWeight: "bold" }}
            >
              {t("suggestions.general.title")}
            </Typography>
            <List>
              <ListItem
                component="button"
                onClick={() => sendMessage(t("suggestions.general.email"))}
                sx={{
                  backgroundColor: "background.paper",
                  mb: 2,
                  borderRadius: 1,
                  boxShadow: 1,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <ListItemIcon>
                  <EmailIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={t("suggestions.general.email")} />
              </ListItem>
              <ListItem
                component="button"
                onClick={() => sendMessage(t("suggestions.general.hire"))}
                sx={{
                  backgroundColor: "background.paper",
                  borderRadius: 1,
                  boxShadow: 1,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <ListItemIcon>
                  <HelpOutlineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={t("suggestions.general.hire")} />
              </ListItem>
            </List>
          </Box>
        </Grid>
        <Grid item xs={12} md={5}>
          <Box
            sx={{
              backgroundColor: "primary.light",
              borderRadius: 2,
              p: 3,
              height: "100%",
              boxShadow: 3,
              transition: "transform 0.3s, box-shadow 0.3s",
              "&:hover": {
                transform: "translateY(-5px)",
                boxShadow: 6,
              },
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              align="center"
              color="common.white"
              sx={{ mb: 2, fontWeight: "bold" }}
            >
              {t("suggestions.business.title")}
            </Typography>
            <List>
              <ListItem
                component="button"
                onClick={() => sendMessage(t("suggestions.business.find"))}
                sx={{
                  backgroundColor: "background.paper",
                  mb: 2,
                  borderRadius: 1,
                  boxShadow: 1,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <ListItemIcon>
                  <ReceiptIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={t("suggestions.business.find")} />
              </ListItem>
              <ListItem
                component="button"
                onClick={() => sendMessage(t("suggestions.business.pspc"))}
                sx={{
                  backgroundColor: "background.paper",
                  borderRadius: 1,
                  boxShadow: 1,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <ListItemIcon>
                  <ReceiptIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={t("suggestions.business.pspc")} />
              </ListItem>
            </List>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Suggestions;
