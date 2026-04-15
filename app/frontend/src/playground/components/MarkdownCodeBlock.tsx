import React, { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";

export interface MarkdownCodeBlockProps extends React.ComponentPropsWithoutRef<"code"> {
  inline?: boolean;
}

const extractNodeText = (node: React.ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map((child) => extractNodeText(child)).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractNodeText(node.props.children);
  }
  return "";
};

const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  inline,
  className,
  children,
  ...rest
}) => {
  const { t } = useTranslation("playground");
  const [isCopied, setIsCopied] = useState(false);
  const codeText = useMemo(() => extractNodeText(children).replace(/\n$/, ""), [children]);
  const isLikelyBlockCode = Boolean(className?.includes("language-")) || codeText.includes("\n");
  const shouldRenderInline = inline ?? !isLikelyBlockCode;

  useEffect(() => {
    if (!isCopied) return;
    const timerId = window.setTimeout(() => setIsCopied(false), 1400);
    return () => window.clearTimeout(timerId);
  }, [isCopied]);

  const handleCopyCode = async () => {
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
      setIsCopied(true);
    } catch {
      // Clipboard API may be unavailable in some browser contexts.
    }
  };

  if (shouldRenderInline) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Tooltip title={isCopied ? t("assistant.copied") : t("assistant.copy.code")}>
        <IconButton
          size="small"
          aria-label={t("assistant.copy.code")}
          onClick={handleCopyCode}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(255,255,255,0.86)",
            border: "1px solid rgba(0,0,0,0.12)",
            zIndex: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.96)" },
          }}
        >
          {isCopied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
      <pre style={{ margin: 0 }}>
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </Box>
  );
};

export default MarkdownCodeBlock;
