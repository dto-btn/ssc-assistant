import { Box, Paper, Container, Divider, Chip, Stack, Typography } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import rehyperaw from 'rehype-raw'
import { useEffect, useState, Fragment } from 'react';
import './AssistantBubble.module.css';

interface AssistantBubbleProps {
    text: string;
    isLoading: boolean;
    context?: Context | null;
    scrollRef?:  React.RefObject<HTMLDivElement>;
  }

function processText(text: string, citations: Citation[]) {
  // Regular expression to find all citation references like [doc1], [doc3], etc.
  const citationRefRegex = /\[doc(\d+)\]/g;

  // Replace citation references with Markdown links
  const processedText = text.replace(citationRefRegex, (docNumber) => {
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

export const AssistantBubble = ({ text, isLoading, context, scrollRef }: AssistantBubbleProps) => {
  const [processedContent, setProcessedContent] = useState({ processedText: '', citedCitations: [] as Citation[] });

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
        <Container>
          <Markdown
            rehypePlugins={[rehypeHighlight, rehyperaw]}
            remarkPlugins={[remarkGfm]}>
            {isLoading
              ? `${text.replace(/\[doc(\d+)\]/g, '')}<span class="blink">⚫</span><span class="blink">⚫</span><span class="blink">⚫</span>`
              : processedContent.processedText}
          </Markdown>
          {/* {isLoading && (
            <span>
              <span className="blink">⚫</span>
              <span className="blink">⚫</span>
              <span className="blink">⚫</span>
            </span>
          )} */}
        </Container>
        {!isLoading && processedContent.citedCitations && processedContent.citedCitations.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 2, maxWidth: '100%' }}>
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
    </Box>
  );
};