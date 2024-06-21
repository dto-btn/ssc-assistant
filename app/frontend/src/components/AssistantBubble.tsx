import { Box, Paper, Divider, Chip, Stack, Typography, Link } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { useEffect, useState, Fragment, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { BubbleButtons } from './BubbleButtons';
import { styled } from '@mui/system';
import ProfileCardsContainer from '../containers/ProfileCardsContainer';
import SmartToyIcon from '@mui/icons-material/SmartToy';

interface AssistantBubbleProps {
    text: string;
    isLoading: boolean;
    context?: Context | null;
    toolInfo?: ToolInfo
    scrollRef?:  React.RefObject<HTMLDivElement>;
    replayChat: () => void;
    index: number;
    total: number;
    setIsFeedbackVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setIsGoodResponse: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AssistantBubble = ({ text, isLoading, context, toolInfo, scrollRef, replayChat, index, total, setIsFeedbackVisible, setIsGoodResponse }: AssistantBubbleProps) => {
  const { i18n } = useTranslation();
  const [processedContent, setProcessedContent] = useState({ processedText: '', citedCitations: [] as Citation[] });
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([])
  const [extraProfiles, setExtraProfiles] = useState<EmployeeProfile[]>([])
  const [profilesExpanded, setExpandProfiles] = useState(false)
  const isMostRecent = index === total - 1;

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

  const processProfiles = useMemo(() => {
    return (employeeProfiles: EmployeeProfile[]) => {
        const matchedProfiles: EmployeeProfile[] = [];
        const unmatchedProfiles: EmployeeProfile[] = [];
        
        employeeProfiles.forEach((profile) => {
            if (text.includes(profile.email)) {
                matchedProfiles.push(profile);
            } else {
                unmatchedProfiles.push(profile);
            }
        });

        return { matchedProfiles, unmatchedProfiles };
    };
}, [text]);

  useEffect(() => {
      if (toolInfo && toolInfo.payload?.hasOwnProperty("profiles")) {
          const { matchedProfiles, unmatchedProfiles } = processProfiles(toolInfo.payload.profiles);
          setProfiles(matchedProfiles);
          setExtraProfiles(unmatchedProfiles);
      }
  }, [toolInfo, text]);


  useEffect(() => processingComplete ? scrollRef?.current?.scrollIntoView({ behavior: "smooth" }) : undefined, [processingComplete, scrollRef]);

  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const handleToggleShowProfiles = () => {
    setExpandProfiles(!profilesExpanded)
  }

  return (
    <ChatBubbleWrapper>
      <ChatBubbleView
        className="chatBubbleView"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Box>
          <Paper
            sx={{
              bgcolor: '#f2f2f2',
              color: 'grey.contrastText',
              display: 'inline-block',
              borderRadius: '20px',
              borderTopLeftRadius: 0,
              flexDirection: 'row'
            }}
            elevation={4}
          >
            <TextAndPictureContainer>
              <IconView>
                <SmartToyIcon sx={{color: "primary.main", fontSize: 30}} />
              </IconView>
              <TextComponentsBox>
                <Markdown
                  components={components}
                  rehypePlugins={[rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}>
                  {isLoading
                    ? `${text.replace(/\[doc(\d+)\]/g, '')}_`
                    : (processedContent.processedText !== "" ? processedContent.processedText : text)}
                </Markdown>
              </TextComponentsBox>
            </TextAndPictureContainer>
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
            {!isLoading && profiles.length > 0 &&
            <ProfileCardsContainer
              profiles={profiles}
              extraProfiles={extraProfiles}
              isExpanded={profilesExpanded}
              toggleShowProfileHandler={handleToggleShowProfiles}
            />
            } 
          </Paper>
        </Box>
        <Box>
          {total > 1 && index !!!= 0  &&
          <Paper sx={{backgroundColor: 'transparent', boxShadow: 'none', mt: 1, ml:2}}>
            <BubbleButtons setIsFeedbackVisible={setIsFeedbackVisible} setIsGoodResponse={setIsGoodResponse} isHovering={isHovering} isMostRecent={isMostRecent} replayChat={replayChat} text={text} />
          </Paper>
          }
        </Box>
      </ChatBubbleView>
    </ChatBubbleWrapper>
  );
};

const ChatBubbleWrapper = styled(Box)`
  display: flex;
  max-width: 80%;
`;

const ChatBubbleView = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`

const TextAndPictureContainer = styled(Box)`
  display: flex;
  padding: 0px 15px;
`

const IconView = styled(Box)`
  margin: 8px 10px 8px 0px;
`

const TextComponentsBox = styled(Box)`
`;