import React from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckCircle from "@mui/icons-material/CheckCircle";
import RemoveCircleOutline from "@mui/icons-material/RemoveCircleOutline";

interface BusinessRequestUpdatesProps {
  data: Array<BusinessRequestUpdate>;
  lang: string;
}

const BusinessRequestUpdates: React.FC<BusinessRequestUpdatesProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box sx={{ marginLeft: 5 }}>
      <TableContainer component={Paper} sx={{ backgroundColor: theme.palette.secondary.contrastText}}>
        <Table
          // Styling for all the table cells
          sx={{
            width: "100%",
            "& th, & td": {
              "padding": 0
            },
            "& th:first-child": {
              paddingLeft: "10px"
            },
            "& td:last-child": {
              paddingRight: "10px"
            },
          }}
          aria-label={t("business.request.updates")}
          size="small"
        >
          <TableHead>
            <TableRow sx={{
              "& th": {
                padding: "3px 2px"
              }
            }}>
              <TableCell >{t("active")}</TableCell>
              <TableCell >{t("status")}</TableCell>
              {/* <TableCell align="right">{t("active")}</TableCell> */}
              <TableCell align="right" >{t("implementation.flag")}</TableCell>
              <TableCell align="right" >{t("days.in.status")}</TableCell>
              <TableCell align="right" >{t("last.status.date")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => {
              const isRowActive = row.BR_ACTIVE_EN.toLowerCase() === "active";
              return (
                <TableRow
                  key={index}
                  sx={{
                    "padding": 0
                  }}
                >
                  <TableCell align="right" >

                    {
                      <Tooltip
                        title={isEnglish ? row.BR_ACTIVE_EN : row.BR_ACTIVE_FR} sx={{ "cursor": "help" }} followCursor>
                        {isRowActive
                          ? <CheckCircle sx={{ "marginRight": 2 }} color="info" aria-label={isEnglish ? row.BR_ACTIVE_EN : row.BR_ACTIVE_FR} />
                          : <RemoveCircleOutline sx={{ "marginRight": 2 }} color="disabled" aria-label={isEnglish ? row.BR_ACTIVE_EN : row.BR_ACTIVE_FR} />
                        }
                      </Tooltip>
                    }
                  </TableCell>
                  <TableCell >
                    {isEnglish ? row.BITS_STATUS_EN : row.BITS_STATUS_FR}
                  </TableCell>
                  <TableCell align="right" >
                    {isEnglish ? row.IMPL_FLAG_EN : row.IMPL_FLAG_FR}
                  </TableCell>
                  <TableCell align="right" >
                    {Math.floor(Number(row.DAYS_IN_STATUS))}
                  </TableCell>
                  <TableCell align="right" >
                    {new Date(row.LAST_STATUS_DATE).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BusinessRequestUpdates;
