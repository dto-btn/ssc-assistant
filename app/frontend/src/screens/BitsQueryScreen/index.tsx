import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, FormControlLabel, Switch } from "@mui/material";
import { useTranslation } from "react-i18next";
import NewLayout from "../../components/layouts/NewLayout";
import { TopMenuHomePage } from "../../components/TopMenu/TopMenuHomePage";
import { useAppStore } from "../../stores/AppStore";
import BitsFilterForm from "./components/BitsFilterForm";
import { BitsQueryParams } from "./types";
import { BusinessRequest } from "../../api/models";
import BusinessRequestTable from "../../components/BusinessRequests/BusinessRequestTable";
import BusinessRequestMetadata from "../../components/BusinessRequests/BusinessRequestMetadata";
import { searchBits } from "../../api/bits.api";
import ChatPanel from "./components/ChatPanel";
import BitsAgentPanel from "./components/BitsAgentPanel";

const BitsQueryScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const appStore = useAppStore();
  
  // State to store query parameters
  const [queryParams, setQueryParams] = useState<BitsQueryParams>({
    query_filters: [],
    limit: 100,
    statuses: []
  });
  
  // State to store query results
  const [results, setResults] = useState<BusinessRequest[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to toggle between Chat Panel and Agent Panel
  const [useAgent, setUseAgent] = useState<boolean>(true);

  // Handle form submission
  const handleQuerySubmit = async (params: BitsQueryParams) => {
    setIsLoading(true);
    setError(null);
    setQueryParams(params);
    
    try {
      const data = await searchBits(params);
      
      if (data.error) {
        setError(data.error);
        setResults([]);
        setMetadata(null);
      } else {
        setResults(data.br || []);
        setMetadata(data.metadata || null);
      }
    } catch (err) {
      setError(t("bits.query.error"));
      console.error("Error fetching BITS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NewLayout
      appDrawerContents={
        <Box>
          <Box sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useAgent}
                  onChange={(e) => setUseAgent(e.target.checked)}
                  color="primary"
                />
              }
              label={useAgent ? t("bits.agent.use.agent") : t("bits.chat.use.chat")}
            />
          </Box>
          {useAgent ? <BitsAgentPanel /> : <ChatPanel />}
        </Box>
      }
      appBar={<TopMenuHomePage 
        childrenLeftOfLogo={null} 
        enabledTools={appStore.tools.enabledTools} 
        handleUpdateEnabledTools={() => {}} 
        selectedModel=""
        handleSelectedModelChanged={() => {}}
        logout={() => {}}
      />}
    >
      <Box sx={{ padding: 3, maxWidth: "100%", overflowX: "auto" }}>
        <Typography variant="h4" gutterBottom>
          {t("bits.query.title", "BITS Query Tool")}
        </Typography>

        {/* Filters tray at the top of the page */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <BitsFilterForm onSubmit={handleQuerySubmit} isLoading={isLoading} />
        </Paper>
        
        {/* Results section */}
        {error ? (
          <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: "error.light" }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        ) : null}

        {metadata && (
          <Box sx={{ mb: 2 }}>
            <BusinessRequestMetadata metadata={metadata} />
          </Box>
        )}

        {results.length > 0 ? (
          <BusinessRequestTable data={results} lang={i18n.language} />
        ) : !isLoading && !error ? (
          <Paper elevation={2} sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1">
              {t("bits.query.no.results", "No results found. Try adjusting your search filters.")}
            </Typography>
          </Paper>
        ) : null}
        
        {isLoading && (
          <Paper elevation={2} sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1">
              {t("bits.query.loading", "Loading results...")}
            </Typography>
          </Paper>
        )}
      </Box>
    </NewLayout>
  );
};

export default BitsQueryScreen;
