import React, { useEffect, useState } from 'react';
import { Tooltip } from '@mui/material';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from "react-i18next";
import { CopyToClipboard } from 'react-copy-to-clipboard';

interface BubbleButtonsProps {
    setIsFeedbackVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setIsGoodResponse: React.Dispatch<React.SetStateAction<boolean>>;
    isHovering: boolean;
    isMostRecent: boolean;
    replayChat: () => void;
    text: string;
}

export const BubbleButtons: React.FC<BubbleButtonsProps> = (props: BubbleButtonsProps) => {
  const { setIsFeedbackVisible, setIsGoodResponse, isHovering, isMostRecent, replayChat, text } = props;
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isCopied) {
        const timer = setTimeout(() => {
            setIsCopied(false);
        }, 3000);
        return () => clearTimeout(timer);
    }
}, [isCopied]);

  return (
    <>
        <CopyToClipboard text={text} onCopy={() => setIsCopied(true)}>
        <Tooltip title={isCopied ? t("copy.success") : t("copy")} arrow>
          <button
            style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none' }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            tabIndex={0}>
            {isCopied ? <CheckIcon style={{ fontSize: 20 }}/> : <ContentCopyIcon className="copy-icon" style={{ fontSize: 20, color: (isHovering || isFocused || isMostRecent) ? '#4b3e99' : 'transparent' }}/>}
          </button>
        </Tooltip>
      </CopyToClipboard>
      <Tooltip title={t("regenerate")} arrow>
        <button
            onClick={replayChat}
            style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none', display: isMostRecent ? 'inline' : 'none' }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            tabIndex={0}
        >
          <RefreshIcon style={{ fontSize: 20, color: (isHovering || isFocused || isMostRecent) ? '#4b3e99' : 'transparent' }}/>
        </button>
      </Tooltip>
      <Tooltip title={t("good.response")} arrow>
        <button
          onClick={() => {
            setIsFeedbackVisible(true);
            setIsGoodResponse(true);
          }}
          style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none' }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={0}
        >
          <ThumbUpAltOutlinedIcon style={{ fontSize: 20, color: (isHovering || isFocused || isMostRecent) ? '#4b3e99' : 'transparent' }}/>
        </button>
      </Tooltip>
      <Tooltip title={t("bad.response")} arrow>
        <button
          onClick={() => {
            setIsFeedbackVisible(true);
            setIsGoodResponse(false);
          }}
          style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none' }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={0}
        >
          <ThumbDownAltOutlinedIcon style={{ fontSize: 20, color: (isHovering || isFocused || isMostRecent) ? '#4b3e99' : 'transparent' }}/>
        </button>
      </Tooltip>
    </>
  );
};
