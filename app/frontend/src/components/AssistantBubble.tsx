import { Box, Paper, LinearProgress, Container, Divider, Chip, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { useEffect, useState, Fragment, RefObject } from 'react';

interface AssistantBubbleProps {
    text: string | null | undefined;
    isLoading: boolean;
    context?: Context | null;
    scrollRef?:  React.RefObject<HTMLDivElement>;
  }

function processText(text: string, citations: Citation[]) {
  // Regular expression to find all citation references like [doc1], [doc3], etc.
  const citationRefRegex = /\[doc(\d+)\]/g;

  // Replace citation references with Markdown links
  const processedText = text.replace(citationRefRegex, (match, docNumber) => {
    // Convert docNumber to an array index (subtracting 1 because arrays are zero-indexed)
    const index = parseInt(docNumber, 10) - 1;
    const citation = citations[index]; // Access the citation by index

    if (citation) {
      //return `[${citation.title}](${citation.url})`; // Replace with Markdown link
      return ` [Doc ${docNumber}](${citation.url})`; // Replace with Markdown link
    }
    return '';
  });

  // Filter the citations array to only include the cited documents
  const citedCitations = citations.filter((citation, index) => {  
    const docNumber = index + 1; // Convert index to docNumber  
    return text.includes(`[doc${docNumber}]`); // Check if the citation is in the text  
  });

  return { processedText, citedCitations };
}

export const AssistantBubble = ({ text, isLoading, context, scrollRef }: AssistantBubbleProps) => {
  const [processedContent, setProcessedContent] = useState({ processedText: '', citedCitations: [] as Citation[] });
  const theme = useTheme();

  useEffect(() => {
    if (!isLoading && context && text) {
      const { processedText, citedCitations } = processText(text, context.citations);
      setProcessedContent({ processedText, citedCitations });
      scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
    } else if (!isLoading && text) {
      setProcessedContent({ processedText: text, citedCitations: [] as Citation[] });
    }
  }, [isLoading, context, text]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', my: '2rem' }}>
      <Paper
        sx={{
          bgcolor: 'white',
          color: 'white.contrastText',
          borderRadius: '20px',
          borderTopLeftRadius: 0,
          maxWidth: '80%',
        }}
      >
        {(text !== null && text !== undefined && text !== '') ?
          (
          <Container>
            <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{isLoading ? text.replace(/\[doc(\d+)\]/g, '') : processedContent.processedText}</Markdown>
            {isLoading && (
              <>
                <LinearProgress color="inherit" sx={{ width: '70%', mt: 1, height: theme.typography.fontSize}}/>
                <LinearProgress color="inherit" sx={{ width: '90%', mt: 1, mb: 2, height: theme.typography.fontSize}}/>
              </>
            )}
          </Container>
          ) : (
            <Container sx={{ minWidth: theme.breakpoints.values.sm, width: '100%', py: 2 }}>
              <LinearProgress color="inherit" sx={{ width: '100%', mt: 1, height: theme.typography.fontSize}}/>
              <LinearProgress color="inherit" sx={{ width: '70%', mt: 1, height: theme.typography.fontSize}}/>
              <LinearProgress color="inherit" sx={{ width: '90%', my: 1, height: theme.typography.fontSize}}/>
            </Container>
          )
        }
        {!isLoading && processedContent.citedCitations && processedContent.citedCitations.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 2, maxWidth: '100%' }}>
              <Typography gutterBottom variant="subtitle2">
                Citation(s):
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {context?.citations.map( (citation, index) => (
                <Fragment key={index}>
                  <Chip
                    label={index+1 + " - " + citation.title}
                    component="a"
                    href={citation.url}
                    target='_blank'
                    variant={processedContent.citedCitations.includes(citation) ? "filled" : "outlined"}
                    clickable
                    color={processedContent.citedCitations.includes(citation) ? "primary" : "default"}
                  />
                </Fragment>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};