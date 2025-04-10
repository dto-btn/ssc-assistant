import { Typography } from '@mui/material'

/**
 * Note: could move this component elsewhere if needed other places
 * @param date 
 * @returns 
 */

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleString("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
};

interface DateDisplayProps {
  dateString: string;
}

export const DateDisplay = ({ dateString }: DateDisplayProps) => {
  return (
    <Typography variant="button" gutterBottom sx={{ display: 'block' }}>
      {formatDate(dateString)}
    </Typography>)
}
