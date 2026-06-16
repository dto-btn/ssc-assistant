import { Typography } from "@mui/material";

export const formatDate = (dateString: string): string => {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-CA", {
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
    <Typography variant="button">
      {formatDate(dateString)}
    </Typography>
  );
};
