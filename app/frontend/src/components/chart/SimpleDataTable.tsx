import { Box, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import React from "react";

type SimpleDataTableProps<T = any> = {
    columnMappings: {
        headerLabel: string;
        key: keyof T;
    }[];
    data: T[];
}
export const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ data, columnMappings }) => {
    return (

        <Box maxWidth={800}>
            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableHead>
                        <TableRow>
                            {
                                columnMappings.map((column) => (
                                    <TableCell key={column.headerLabel}>{column.headerLabel}</TableCell>
                                ))
                            }
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((obj) => (
                            <TableRow key={JSON.stringify(obj)}>
                                {
                                    columnMappings.map((column, index) => (
                                        <TableCell key={`${index}-${column.headerLabel}`}>{obj[column.key]}</TableCell>
                                    ))
                                }
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box >
    )
}