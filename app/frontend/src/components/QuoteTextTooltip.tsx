
import { Box } from "@mui/material";
import { useEffect, useState } from "react"

interface QuoteTextTooltipProps {
    addQuotedText: (quotedText:string) => void;
}

const QuoteTextTooltip = ({addQuotedText}: QuoteTextTooltipProps) => {
    const [selectedText, setSelectedText] = useState<string>();
    const [position, setPosition] = useState<Record<string, number>>();

    const onSelectStart = () => {
        setSelectedText(undefined);
    }
    const debounce = (func: (...args: any) => void, timeout = 300) => {
        let timer: NodeJS.Timeout;
        return (...args: any) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                func(...args);
            }, timeout);
        };
    };

    const onSelectEnd = debounce(() => {
        const activeSelection = document.getSelection();
        if (!activeSelection || activeSelection.rangeCount < 1) {
            setSelectedText(undefined);
            return;
        }

        const text = activeSelection.toString().trim();
        if (!text) {
            setSelectedText(undefined);
            return;
        }

        setSelectedText(text);

        const range = activeSelection.getRangeAt(0);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          let topRect = rects[0];
          for (let i = 1; i < rects.length; i++) {
            const rect = rects[i];
            if (rect.top < topRect.top || (rect.top === topRect.top && rect.left < topRect.left)) {
              topRect = rect;
            }
            }
            setPosition({
                x: topRect.left + window.scrollX,
                y: topRect.top + window.scrollY
            });
        }
    });

    useEffect(() => {
        document.addEventListener('selectstart', onSelectStart);
        document.addEventListener('mouseup', onSelectEnd);
        return () => {
            document.removeEventListener('selectstart', onSelectStart);
            document.removeEventListener('mouseup', onSelectEnd);
        };
    }, []);


    const handleQuoteText = () => {
        if (selectedText) {
            addQuotedText(selectedText);
        }
        setSelectedText(undefined);
        window.getSelection()?.removeAllRanges();    
    };

    return (
        <div>
            {selectedText && position && (
                <Box
                component="button"
                sx={{
                    position: 'absolute',
                    top: position.y - 45,
                    left: position.x,
                    height: '40px',
                    width: '90px',
                    border: '1px solid',
                    borderRadius: '15px',
                    fontSize: '14px',
                    color: 'white',
                    fontWeight: '600',
                    backgroundColor: 'primary.light',
                    zIndex: 1000,
                    '&:hover': {
                        backgroundColor: 'primary.main',
                        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
                    },
                }}
                onClick={() => handleQuoteText()}
            >
                Quote this response
            </Box>
            )}
        </div>
    )
}

export default QuoteTextTooltip