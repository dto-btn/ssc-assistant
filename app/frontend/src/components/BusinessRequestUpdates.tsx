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

interface BusinessRequestUpdatesProps {
  data: Array<BusinessRequestUpdate>;
  lang: string;
}

const BusinessRequestUpdates: React.FC<BusinessRequestUpdatesProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  return (
    <Box sx={{ marginLeft: 5 }}>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Impl. Flag</TableCell>
              <TableCell align="right">Days in status</TableCell>
              <TableCell align="right">Last Status date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {isEnglish ? row.BITS_STATUS_EN : row.BITS_STATUS_FR}
                </TableCell>
                <TableCell align="right">
                  {isEnglish ? row.BR_ACTIVE_EN : row.BR_ACTIVE_FR}
                </TableCell>
                <TableCell align="right">
                  {isEnglish ? row.IMPL_FLAG_EN : row.IMPL_FLAG_FR}
                </TableCell>
                <TableCell align="right">{row.DAYS_IN_STATUS}</TableCell>
                <TableCell align="right">
                  {new Date(row.LAST_STATUS_DATE).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BusinessRequestUpdates;
