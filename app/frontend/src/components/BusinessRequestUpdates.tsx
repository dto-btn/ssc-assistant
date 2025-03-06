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
} from "@mui/material";
import { useTranslation } from "react-i18next";

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
  return (
    <Box sx={{ marginLeft: 5 }}>
      <TableContainer component={Paper}>
        <Table
          sx={{ minWidth: 650 }}
          aria-label={t("business.request.updates")}
          size="small"
        >
          <TableHead>
            <TableRow>
              <TableCell>{t("status")}</TableCell>
              {/* <TableCell align="right">{t("active")}</TableCell> */}
              <TableCell align="right">{t("implementation.flag")}</TableCell>
              <TableCell align="right">{t("days.in.status")}</TableCell>
              <TableCell align="right">{t("last.status.date")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => {
              const isRowActive = row.BR_ACTIVE_EN.toLowerCase() === "active";
              return (
                <TableRow
                  key={index}
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                    backgroundColor: isRowActive
                      ? "rgba(0, 255, 0, 0.3)"
                      : "rgba(255, 0, 0, 0.3)",
                  }}
                >
                  <TableCell component="th" scope="row">
                    {isEnglish ? row.BITS_STATUS_EN : row.BITS_STATUS_FR}
                  </TableCell>
                  {/* <TableCell align="right">
                    {isEnglish ? row.BR_ACTIVE_EN : row.BR_ACTIVE_FR}
                  </TableCell> */}
                  <TableCell align="right">
                    {isEnglish ? row.IMPL_FLAG_EN : row.IMPL_FLAG_FR}
                  </TableCell>
                  <TableCell align="right">
                    {Math.floor(Number(row.DAYS_IN_STATUS))}
                  </TableCell>
                  <TableCell align="right">
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
