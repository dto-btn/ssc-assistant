import { Box, Paper, Container, Divider, Chip, Stack, Typography, Link } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { useEffect, useState, Fragment } from 'react';
import { useTranslation } from "react-i18next";
import './AssistantBubble.css';
import { CopyToClipboard } from 'react-copy-to-clipboard';  
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';

interface AssistantBubbleProps {
    text: string;
    isLoading: boolean;
    context?: Context | null;
    scrollRef?:  React.RefObject<HTMLDivElement>;
    replayChat: () => void;
    index: number;
    total: number;
  }

export const AssistantBubble = ({ text, isLoading, context, scrollRef, replayChat, index, total }: AssistantBubbleProps) => {
  const { t, i18n } = useTranslation();
  const [processedContent, setProcessedContent] = useState({ processedText: '', citedCitations: [] as Citation[] });
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isHovering, setIsHovering] = useState(false);  
  const [isCopied, setIsCopied] = useState(false);  
  const [isFocused, setIsFocused] = useState(false);  
  const components = {    
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <Link target="_blank" rel="noopener noreferrer" {...props} />,    
  };
  const [citationNumberMapping, setCitationNumberMapping] = useState<{ [key: number]: number }>({});  


  function processText(text: string, citations: Citation[]) {
    // Regular expression to find all citation references like [doc1], [doc3], etc.
    const citationRefRegex = /\[doc(\d+)\]/g;
  
    // Map to store the new citation numbers  
    const citationNumberMapping: { [key: number]: number } = {};  
  
    // Identify the cited citations and create the citationNumberMapping  
    citations.forEach((_, index) => {  
        const docNumber = index + 1; // Convert index to docNumber  
        if (text.includes(`[doc${docNumber}]`)) { // Check if the citation is in the text  
            // The new citation number is the current size of citationNumberMapping + 1  
            citationNumberMapping[docNumber] = Object.keys(citationNumberMapping).length + 1;  
        }  
    });  
  
    // Filter the citations array to only include the cited documents  
    const citedCitations = citations.filter((_, index) => {  
        const docNumber = index + 1; // Convert index to docNumber  
        return citationNumberMapping[docNumber]; // Check if the citation is in the citationNumberMapping  
    });  
  
    // Replace citation references with Markdown links using the new citation numbers  
    const processedText = text.replace(citationRefRegex, (_, docNumber) => {  
        const citation = citations[parseInt(docNumber, 10) - 1]; // Access the citation by index  
        if (citation) {  
            const newCitationNumber = citationNumberMapping[parseInt(docNumber, 10)]; // Get the new citation number  
            return ` [${newCitationNumber}](${citation.url})`; // Replace with Markdown link  
        }  
        return '';  
    }); 
  
    return { processedText, citedCitations, citationNumberMapping };
  }

  useEffect(() => {  
    if(context?.citations) {  
        const { processedText, citedCitations, citationNumberMapping } = processText(text, context.citations);  
        setProcessedContent({ processedText, citedCitations });  
        setCitationNumberMapping(citationNumberMapping); // store the citationNumberMapping in state  
        setProcessingComplete(true);  
    }  
}, [isLoading, context, text, scrollRef]);  


  useEffect(() => processingComplete ? scrollRef?.current?.scrollIntoView({ behavior: "smooth" }) : undefined, [processingComplete, scrollRef]);
  
  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
      sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}
      onMouseEnter={() => setIsHovering(true)}  
      onMouseLeave={() => setIsHovering(false)} 
    >
      <Box>
        <Paper
          sx={{
            bgcolor: 'white',
            color: 'white.contrastText',
            borderRadius: '20px',
            borderTopLeftRadius: 0,
            display: 'inline-block',
            maxWidth: '80%',
            flexDirection: 'row'
          }}
        >
          <Container>
            <Markdown
              components={components}
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
                {context?.citations.map( (citation, index) => {  
                    const docNumber = index + 1; // Convert index to docNumber  
                    const newCitationNumber = citationNumberMapping[docNumber]; // Get the new citation number  
                    return (  
                        processedContent.citedCitations.includes(citation) && (  
                            <Fragment key={index}>  
                                <Chip  
                                    label={newCitationNumber + " - " + citation.title} // Use new citation number  
                                    component="a"  
                                    href={citation.url}  
                                    target='_blank'  
                                    variant="filled"  
                                    clickable  
                                    color="primary"  
                                />  
                            </Fragment>  
                        )  
                    );  
                })}  

                </Stack>
              </Box>
            </>
          )}
        </Paper>
      </Box>
      <Box>
        <Paper sx={{backgroundColor: 'transparent', boxShadow: 'none', mt: 1, ml:2}}>
          <CopyToClipboard text={text} onCopy={() => setIsCopied(true)}>
            <Tooltip title={isCopied ? t("copy.success") : t("copy")} arrow> 
              <button 
                style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none' }}
                onFocus={() => setIsFocused(true)}  
                onBlur={() => setIsFocused(false)}   
                tabIndex={0}>
                {isCopied ? <CheckIcon style={{ fontSize: 20 }}/> : <ContentCopyIcon className="copy-icon" style={{ fontSize: 20, color: (isHovering || isFocused) ? '#4b3e99' : 'transparent' }}/>}
              </button>
            </Tooltip>
          </CopyToClipboard>
          <Tooltip title={t("regenerate")} arrow>  
            <button   
                onClick={replayChat}
                style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none', display: index === total - 1 ? 'inline' : 'none' }}  
                onFocus={() => setIsFocused(true)}  
                onBlur={() => setIsFocused(false)} 
                tabIndex={0}
            >  
                <RefreshIcon style={{ fontSize: 20, color: (isHovering || isFocused) ? '#4b3e99' : 'transparent' }}/>  
            </button>
          </Tooltip> 
        </Paper>
      </Box>  
    </Box>
  );
};
