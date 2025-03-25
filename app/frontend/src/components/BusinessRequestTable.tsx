import React from "react";
import {
  Box,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";

interface BusinessRequestTableProps {
  data: Array<BusinessRequest>;
  lang: string;
}

const BusinessRequestTable: React.FC<BusinessRequestTableProps> = ({
  data,
  lang,
}) => {
  const isEnglish = lang === "en";
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box>
      <TableContainer
        component={Paper}
        sx={{ backgroundColor: theme.palette.secondary.contrastText }}
      >
        <Table aria-label={t("business.request.updates")}>
          <TableHead>
            <TableRow>
              <TableCell>{t("business.request.number")}</TableCell>
              <TableCell>{t("business.request.title")}</TableCell>
              <TableCell>{t("client.name")}</TableCell>
              <TableCell>{t("br.owner")}</TableCell>
              <TableCell>{t("status")}</TableCell>
              <TableCell>{t("priority")}</TableCell>
              <TableCell>{t("submit.date")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => {
              return (
                <TableRow key={index}>
                  <TableCell>
                    <Link
                      href={`https://bitsprod.ssc-spc.gc.ca/BR/${row.BR_NMBR}`}
                      rel="noopener"
                      target="_blank"
                    >
                      #{row.BR_NMBR}
                    </Link>
                  </TableCell>
                  <TableCell>{row.BR_SHORT_TITLE}</TableCell>
                  <TableCell>
                    {isEnglish
                      ? row.RPT_GC_ORG_NAME_EN
                      : row.RPT_GC_ORG_NAME_FR}
                  </TableCell>
                  <TableCell>{row.BR_OWNER}</TableCell>
                  <TableCell>
                    {isEnglish ? row.BITS_STATUS_EN : row.BITS_STATUS_FR}
                  </TableCell>
                  <TableCell>
                    {isEnglish ? row.PRIORITY_EN : row.PRIORITY_FR}
                  </TableCell>
                  <TableCell>
                    {new Date(row.SUBMIT_DATE).toLocaleDateString()}
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

export default BusinessRequestTable;
