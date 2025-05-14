import React, { useState, useEffect } from "react";
import { 
  Box, 
  Button, 
  FormControl, 
  InputLabel, 
  MenuItem, 
  Select, 
  TextField, 
  Grid, 
  IconButton, 
  Typography, 
  Chip,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import { BitsQueryParams, BitsQueryFilter, BitsStatus, BitsFieldMap } from "../types";
import { getBitsFields, getBitsStatuses } from "../../../api/bits.api";

interface BitsFilterFormProps {
  onSubmit: (params: BitsQueryParams) => void;
  isLoading: boolean;
}

const BitsFilterForm: React.FC<BitsFilterFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState<BitsFieldMap>({});
  const [statuses, setStatuses] = useState<BitsStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [filters, setFilters] = useState<BitsQueryFilter[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // Fetch available fields and statuses on mount
  useEffect(() => {
    const fetchFieldsAndStatuses = async () => {
      setIsLoadingFields(true);
      setIsLoadingStatuses(true);
      
      try {
        // Fetch available fields
        const fieldsData = await getBitsFields();
        setFields(fieldsData || {});
        
        // Fetch available statuses
        const statusesData = await getBitsStatuses();
        setStatuses(statusesData?.statuses || []);
      } catch (error) {
        console.error("Error fetching BITS metadata:", error);
      } finally {
        setIsLoadingFields(false);
        setIsLoadingStatuses(false);
      }
    };
    
    fetchFieldsAndStatuses();
  }, []);
  
  // Add a new empty filter
  const addFilter = () => {
    const fieldNames = Object.keys(fields);
    const newFilter: BitsQueryFilter = {
      name: fieldNames.length > 0 ? fieldNames[0] : "",
      value: "",
      operator: "="
    };
    setFilters([...filters, newFilter]);
  };
  
  // Remove a filter at specific index
  const removeFilter = (index: number) => {
    const updatedFilters = [...filters];
    updatedFilters.splice(index, 1);
    setFilters(updatedFilters);
  };
  
  // Update a specific filter's property
  const updateFilter = (index: number, field: keyof BitsQueryFilter, value: string) => {
    const updatedFilters = [...filters];
    updatedFilters[index] = { ...updatedFilters[index], [field]: value };
    setFilters(updatedFilters);
  };
  
  // Toggle a status selection
  const toggleStatus = (statusId: string) => {
    if (selectedStatuses.includes(statusId)) {
      setSelectedStatuses(selectedStatuses.filter(id => id !== statusId));
    } else {
      setSelectedStatuses([...selectedStatuses, statusId]);
    }
  };
  
  // Handle form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    const queryParams: BitsQueryParams = {
      query_filters: filters.filter(f => f.name && f.value), // Only include complete filters
      limit,
      statuses: selectedStatuses
    };
    
    onSubmit(queryParams);
  };
  
  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        {t("bits.filter.title", "Search Filters")}
      </Typography>
      
      {/* Field filters section */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1">
              {t("bits.filter.conditions", "Filter Conditions")}
            </Typography>
            <Button 
              startIcon={<AddIcon />} 
              onClick={addFilter}
              disabled={isLoadingFields}
              size="small"
              sx={{ ml: 2 }}
            >
              {t("bits.filter.add", "Add Filter")}
            </Button>
          </Box>
          
          {isLoadingFields ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2 }}>
                {t("bits.loading.fields", "Loading available fields...")}
              </Typography>
            </Box>
          ) : (
            <>
              {filters.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("bits.filter.none", "No filters added. Add a filter to refine your search.")}
                </Typography>
              )}
              
              {filters.map((filter, index) => (
                <Grid container spacing={2} key={index} alignItems="center" sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t("bits.filter.field", "Field")}</InputLabel>
                      <Select
                        value={filter.name}
                        label={t("bits.filter.field", "Field")}
                        onChange={(e) => updateFilter(index, 'name', e.target.value)}
                      >
                        {Object.entries(fields).map(([key, field]) => (
                          <MenuItem key={key} value={key}>
                            {key} {field.description ? `(${field.description})` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{t("bits.filter.operator", "Operator")}</InputLabel>
                      <Select
                        value={filter.operator}
                        label={t("bits.filter.operator", "Operator")}
                        onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                      >
                        <MenuItem value="=">=</MenuItem>
                        <MenuItem value="<">&lt;</MenuItem>
                        <MenuItem value=">">&gt;</MenuItem>
                        <MenuItem value="<=">&lt;=</MenuItem>
                        <MenuItem value=">=">&gt;=</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t("bits.filter.value", "Value")}
                      value={filter.value}
                      onChange={(e) => updateFilter(index, 'value', e.target.value)}
                      // Add type="date" if the field is a date field
                      // type={fields[filter.name]?.name?.endsWith("_DATE") ? "date" : "text"}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={2}>
                    <IconButton color="error" onClick={() => removeFilter(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </>
          )}
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />
      
      {/* Status filters section */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {t("bits.filter.statuses", "Status Filters")}
            {selectedStatuses.length > 0 && (
              <Chip
                label={`${selectedStatuses.length} ${t("bits.filter.selected", "selected")}`}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {isLoadingStatuses ? (
            <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
              <CircularProgress size={24} />
              <Typography sx={{ ml: 2 }}>
                {t("bits.loading.statuses", "Loading statuses...")}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {statuses.map((status) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={status.STATUS_ID}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedStatuses.includes(status.STATUS_ID)}
                        onChange={() => toggleStatus(status.STATUS_ID)}
                      />
                    }
                    label={`${status.NAME_EN} (${status.PHASE_EN})`}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>
      
      <Divider sx={{ my: 2 }} />
      
      {/* Results limit */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4} md={3}>
          <TextField
            fullWidth
            type="number"
            label={t("bits.filter.limit", "Results Limit")}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
            inputProps={{ min: 1, max: 1000 }}
            size="small"
          />
        </Grid>
        
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SearchIcon />}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1, color: 'white' }} />
                {t("bits.searching", "Searching...")}
              </>
            ) : (
              t("bits.search", "Search")
            )}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BitsFilterForm;
