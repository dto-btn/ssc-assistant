import { Typography } from '@mui/material'

/**
 * Note: could move this component elsewhere if needed other places
 * @param date 
 * @returns 
 */

export const formatDate = (date: string): string => {
  if(date)
    return new Date(date).toLocaleString("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
  else return "";
};

interface DateDisplayProps {
  dateString: string;
}

export const DateDisplay = ({ dateString }: DateDisplayProps) => {
  return (
    <Typography variant="button">
      {formatDate(dateString)}
    </Typography>)
}
