import { Box, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import React from "react";

type SimpleDataTableProps<T = any> = {
    columnMappings: {
        headerLabel: string;
        key: keyof T;
        renderer?: (value: any) => React.ReactNode;
    }[];
    data: T[];
}
export const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ data, columnMappings }) => {
    return (

        <Box>
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
                                        <TableCell key={`${index}-${column.headerLabel}`}>{
                                            column.renderer ? column.renderer(obj[column.key]) : obj[column.key]
                                        }</TableCell>
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