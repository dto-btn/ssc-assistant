import { Box, Paper, Container, Divider, Chip, Stack, Typography, Toolbar } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { useEffect, useState, Fragment } from 'react';
import './AssistantBubble.css';
import { CopyToClipboard } from 'react-copy-to-clipboard';  
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';

interface AssistantBubbleProps {
    text: string;
    isLoading: boolean;
    context?: Context | null;
    scrollRef?:  React.RefObject<HTMLDivElement>;
  }

export const AssistantBubble = ({ text, isLoading, context, scrollRef }: AssistantBubbleProps) => {
  const [processedContent, setProcessedContent] = useState({ processedText: '', citedCitations: [] as Citation[] });
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isHovering, setIsHovering] = useState(false);  
  const [isCopied, setIsCopied] = useState(false);  

  function processText(text: string, citations: Citation[]) {
    // Regular expression to find all citation references like [doc1], [doc3], etc.
    const citationRefRegex = /\[doc(\d+)\]/g;
  
    // Replace citation references with Markdown links
    const processedText = text.replace(citationRefRegex, (_, docNumber) => {
      // Convert docNumber to an array index (subtracting 1 because arrays are zero-indexed)
      const index = parseInt(docNumber, 10) - 1;
      const citation = citations[index]; // Access the citation by index
      if (citation) {
        //return `[${citation.title}](${citation.url})`; // Replace with Markdown link
        return ` [${docNumber}](${citation.url})`; // Replace with Markdown link
      }
      return '';
    });
  
    // Filter the citations array to only include the cited documents
    const citedCitations = citations.filter((_, index) => {
      const docNumber = index + 1; // Convert index to docNumber
      return text.includes(`[doc${docNumber}]`); // Check if the citation is in the text
    });
  
    return { processedText, citedCitations };
  }

  useEffect(() => {
    if(context?.citations) {
      const { processedText, citedCitations } = processText(text, context.citations);
      setProcessedContent({ processedText, citedCitations });
      setProcessingComplete(true);
    }
  }, [isLoading, context, text, scrollRef]);

  useEffect(() => processingComplete ? scrollRef?.current?.scrollIntoView({ behavior: "smooth" }) : undefined, [processingComplete, scrollRef]);

  useEffect(() => {  
    if (isCopied) {  
        const timer = setTimeout(() => {  
            setIsCopied(false);  
        }, 3000);  
        return () => clearTimeout(timer);  
    }  
}, [isCopied]);  

  return (
    <Box 
      sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}
      onMouseEnter={() => setIsHovering(true)}  
      onMouseLeave={() => setIsHovering(false)} 
    >
      <Paper
        sx={{
          bgcolor: 'white',
          color: 'white.contrastText',
          borderRadius: '20px',
          borderTopLeftRadius: 0,
          maxWidth: '80%',
        }}
      >
        <Container>
          <Markdown
            rehypePlugins={[rehypeHighlight]}
            remarkPlugins={[remarkGfm]}>
            {isLoading
              ? `${text.replace(/\[doc(\d+)\]/g, '')}_`
              : (processedContent.processedText !== "" ? processedContent.processedText : text)}
          </Markdown>
        </Container>
        {!isLoading && processedContent.citedCitations && processedContent.citedCitations.length > 0 && (
          <>
            <Divider />
            <Box sx={{ m: 2, maxWidth: '100%' }}>
              <Typography gutterBottom variant="subtitle2">
                Citation(s):
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {context?.citations.map( (citation, index) => (
                  processedContent.citedCitations.includes(citation) && (
                    <Fragment key={index}>
                      <Chip
                        label={index+1 + " - " + citation.title}
                        component="a"
                        href={citation.url}
                        target='_blank'
                        variant="filled"
                        clickable
                        color="primary"
                      />
                    </Fragment>
                  )
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Paper>
      <Paper sx={{backgroundColor: 'transparent', boxShadow: 'none', mt: 0.5, ml:2}}>
        <CopyToClipboard text={text} onCopy={() => setIsCopied(true)}>
          <Tooltip title={isCopied ? "Copied!" : "Copy"} arrow>
            <button style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none' }}>
              {isCopied ? <CheckIcon style={{ fontSize: 20 }}/> : <ContentCopyIcon className="copy-icon" style={{ fontSize: 20, color: isHovering ? 'grey' : 'transparent' }}/>}
            </button>
          </Tooltip>
        </CopyToClipboard>
      </Paper>
    </Box>
  );
};
