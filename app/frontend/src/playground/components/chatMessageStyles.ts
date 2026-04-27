import { SxProps, Theme } from "@mui/material/styles";

const BASE_CODE_SX = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.88em",
  px: 0.5,
  py: 0.2,
  borderRadius: "6px",
  bgcolor: "rgba(0,0,0,0.06)",
};

const BASE_PRE_SX = {
  my: 1.25,
  p: 1.25,
  borderRadius: "10px",
  overflowX: "auto",
  bgcolor: "rgba(0,0,0,0.06)",
};

const BASE_BLOCKQUOTE_SX = {
  m: 0,
  my: 1,
  pl: 1.25,
  borderLeft: "3px solid",
  borderColor: "rgba(75,63,168,0.45)",
  color: "text.secondary",
};

const BASE_TABLE_CELL_SX = {
  border: "1px solid rgba(0,0,0,0.16)",
  p: 0.65,
  textAlign: "left",
  verticalAlign: "top",
};

export const BASE_MARKDOWN_SX: SxProps<Theme> = {
  fontSize: "0.98rem",
  lineHeight: 1.65,
  wordBreak: "break-word",
  "& > *:first-of-type": { mt: 0 },
  "& > *:last-child": { mb: 0 },
  "& p": { m: 0 },
  "& p + p": { mt: 1.25 },
  "& h1, & h2, & h3, & h4": { mt: 1.5, mb: 0.75, lineHeight: 1.3 },
  "& ul, & ol": { my: 1, pl: 3 },
  "& li + li": { mt: 0.4 },
  "& code": BASE_CODE_SX,
  "& pre": BASE_PRE_SX,
  "& pre code": {
    bgcolor: "transparent",
    p: 0,
    borderRadius: 0,
    fontSize: "0.86em",
  },
  "& blockquote": BASE_BLOCKQUOTE_SX,
  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    my: 1.25,
    fontSize: "0.92em",
  },
  "& th, & td": BASE_TABLE_CELL_SX,
  "& a": {
    textUnderlineOffset: "2px",
  },
  "& .mermaid": {
    maxWidth: "100%",
    overflowX: "auto",
  },
  "& .mermaid svg, & svg[id^='mermaid-']": {
    width: "100% !important",
    height: "auto !important",
    maxWidth: "100%",
    display: "block",
    margin: "0 auto",
  },
};

export const ASSISTANT_MARKDOWN_SX: SxProps<Theme> = {
  ...BASE_MARKDOWN_SX,
  "& a": {
    color: "#4B3FA8",
    fontWeight: 500,
  },
};

export const USER_MARKDOWN_SX: SxProps<Theme> = {
  ...BASE_MARKDOWN_SX,
  "& code": {
    ...BASE_CODE_SX,
    bgcolor: "rgba(255,255,255,0.2)",
  },
  "& pre": {
    ...BASE_PRE_SX,
    bgcolor: "rgba(255,255,255,0.2)",
  },
  "& blockquote": {
    ...BASE_BLOCKQUOTE_SX,
    borderColor: "rgba(255,255,255,0.55)",
    color: "rgba(255,255,255,0.92)",
  },
  "& th, & td": {
    ...BASE_TABLE_CELL_SX,
    border: "1px solid rgba(255,255,255,0.35)",
  },
  "& a": {
    color: "#FFFFFF",
    fontWeight: 500,
  },
};
