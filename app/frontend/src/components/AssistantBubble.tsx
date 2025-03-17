import {
  Box,
  Paper,
  Divider,
  Chip,
  Stack,
  Typography,
  Link,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
  PaperProps,
} from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { useEffect, useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { BubbleButtons } from "./BubbleButtons";
import { styled } from "@mui/system";
import ProfileCardsContainer from "../containers/ProfileCardsContainer";
import HandymanIcon from "@mui/icons-material/Handyman";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { visuallyHidden } from "@mui/utils";
import Draggable from "react-draggable";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import BusinessRequestCard from "./BusinessRequestCard";
import BusinessRequestUpdates from "./BusinessRequestUpdates";
import { transformToBusinessRequest } from "../util/bits_utils";

interface AssistantBubbleProps {
  text: string;
  isLoading: boolean;
  context?: Context | null;
  toolsInfo?: ToolInfo;
  scrollRef?: React.RefObject<HTMLDivElement>;
  replayChat: () => void;
  index: number;
  total: number;
  setIsFeedbackVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsGoodResponse: React.Dispatch<React.SetStateAction<boolean>>;
  handleBookReservation: (bookingDetails: BookingConfirmation) => void;
}

function DraggablePaperComponent(props: PaperProps) {
  return (
    <Draggable
      handle="#draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper {...props} />
    </Draggable>
  );
}

export const AssistantBubble = ({
  text,
  isLoading,
  context,
  toolsInfo,
  scrollRef,
  replayChat,
  index,
  total,
  setIsFeedbackVisible,
  setIsGoodResponse,
  handleBookReservation,
}: AssistantBubbleProps) => {
  const { t, i18n } = useTranslation();
  const [processedContent, setProcessedContent] = useState({
    processedText: "",
    citedCitations: [] as Citation[],
  });
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [profilesExpanded, setExpandProfiles] = useState(false);
  const [floorPlanFilename, setFloorPlanFilename] = useState("");
  const [bookingDetails, setBookingDetails] = useState<
    BookingConfirmation | undefined
  >(undefined);
  const [confirmButtonDisabled, setConfirmButtonDisabled] = useState(false);
  const [isFloorPlanExpanded, setFloorPlanExpanded] = useState(false);
  const isMostRecent = index === total - 1;
  const toolsUsed = toolsInfo && toolsInfo.tool_type.length > 0;
  const [brData, setBrData] = useState<BusinessRequest[] | undefined>(
    undefined
  );
  const [brUpdates, setBrUpdates] = useState<
    BusinessRequestUpdate[] | undefined
  >(undefined);

  const components = {
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <Link target="_blank" rel="noopener noreferrer" {...props} />
    ),
  };
  const [citationNumberMapping, setCitationNumberMapping] = useState<{
    [key: number]: number;
  }>({});

  function processText(text: string, citations: Citation[]) {
    // Regular expression to find all citation references like [doc1], [doc3], etc.
    const citationRefRegex = /\[doc(\d+)\]/g;

    // Map to store the new citation numbers
    const citationNumberMapping: { [key: number]: number } = {};

    // Identify the cited citations and create the citationNumberMapping
    citations.forEach((_, index) => {
      const docNumber = index + 1; // Convert index to docNumber
      if (text.includes(`[doc${docNumber}]`)) {
        // Check if the citation is in the text
        // The new citation number is the current size of citationNumberMapping + 1
        citationNumberMapping[docNumber] =
          Object.keys(citationNumberMapping).length + 1;
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
        const newCitationNumber =
          citationNumberMapping[parseInt(docNumber, 10)]; // Get the new citation number
        return ` [${newCitationNumber}](${citation.url})`; // Replace with Markdown link
      }
      return "";
    });

    return { processedText, citedCitations, citationNumberMapping };
  }

  useEffect(() => {
    if (context?.citations) {
      const { processedText, citedCitations, citationNumberMapping } =
        processText(text, context.citations);
      setProcessedContent({ processedText, citedCitations });
      setCitationNumberMapping(citationNumberMapping); // store the citationNumberMapping in state
      setProcessingComplete(true);
    } else {
      setProcessedContent({ processedText: "", citedCitations: [] });
      setCitationNumberMapping({});
      setProcessingComplete(false);
    }
  }, [isLoading, context, text, scrollRef]);

  useEffect(() => {
    const processProfiles = (employeeProfiles: EmployeeProfile[]) => {
      const processedProfiles: EmployeeProfile[] = [];

      employeeProfiles.forEach((profile) => {
        if (
          text.includes(profile.email) ||
          (profile.phone && text.includes(profile.phone))
        ) {
          profile.matchedProfile = true;
        } else {
          profile.matchedProfile = false;
        }
        processedProfiles.push(profile);
      });

      return processedProfiles;
    };

    if (toolsInfo) {
      if (toolsInfo?.payload?.br) {
        try {
          const brInformation = toolsInfo.payload.br;
          if (brInformation.length) {
            brInformation.map((br: any) => {
              const brData = transformToBusinessRequest(br);
              setBrData((prev) => (prev ? [...prev, brData] : [brData]));
            });
          }
        } catch (error) {
          console.error("Error transforming BR data", error);
        }
      }

      if (toolsInfo?.payload?.br_updates) {
        try {
          const brUpdates = toolsInfo.payload.br_updates;
          setBrUpdates(brUpdates);
        } catch (error) {
          console.error("Error transforming BR update data", error);
        }
      }

      if (
        toolsInfo.payload &&
        Object.prototype.hasOwnProperty.call(toolsInfo.payload, "profiles") &&
        toolsInfo.payload.profiles !== null
      ) {
        const processedProfiles = processProfiles(toolsInfo.payload.profiles);
        setProfiles(processedProfiles);
      }

      if (
        toolsInfo.payload &&
        Object.prototype.hasOwnProperty.call(toolsInfo.payload, "floorPlan")
      ) {
        const floorPlanFile = toolsInfo.payload.floorPlan;
        setFloorPlanFilename(floorPlanFile);
      }

      if (
        toolsInfo.payload &&
        Object.prototype.hasOwnProperty.call(
          toolsInfo.payload,
          "bookingDetails"
        )
      ) {
        setBookingDetails(toolsInfo.payload.bookingDetails);
      }
    }
  }, [toolsInfo, text]);

  useEffect(
    () =>
      processingComplete
        ? scrollRef?.current?.scrollIntoView({ behavior: "smooth" })
        : undefined,
    [processingComplete, scrollRef]
  );

  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const handleToggleShowProfiles = () => {
    setExpandProfiles(!profilesExpanded);
  };

  const handleConfirmButtonClicked = () => {
    setConfirmButtonDisabled(true);
    if (bookingDetails) {
      handleBookReservation(bookingDetails);
    }
  };

  return (
    <ChatBubbleWrapper tabIndex={2}>
      <ChatBubbleView
        className="chatBubbleView"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Box>
          <ChatBubbleInner elevation={4} className={"assistant-bubble-paper"}>
            <MainContentWrapper>
              <IconWrapper>
                <img
                  src={logo}
                  style={{
                    width: "35px",
                    height: "auto",
                    cursor: "pointer",
                  }}
                  alt="logo of SSC"
                />
                {/* <AutoAwesome sx={{ color: "primary.main", fontSize: 24 }} /> */}
              </IconWrapper>
              <TextComponentsBox className="textCompBox">
                <Typography sx={visuallyHidden}>
                  {t("aria.assistant.message")}
                </Typography>{" "}
                {/* Hidden div for screen reader */}
                <Markdown
                  components={components}
                  rehypePlugins={[rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}
                >
                  {isLoading
                    ? `${text.replace(/\[doc(\d+)\]/g, "")}_`
                    : processedContent.processedText !== ""
                    ? processedContent.processedText
                    : text}
                </Markdown>
              </TextComponentsBox>
            </MainContentWrapper>

            {toolsUsed && toolsInfo.tool_type && (
              <ToolsUsedBox>
                <Tooltip title={t("toolsUsed")} arrow>
                  <HandymanIcon
                    style={{
                      fontSize: 16,
                      margin: "0px 3px 0px 0px",
                      color: "#4b3e99",
                    }}
                  />
                </Tooltip>
                <Stack direction="row" spacing={1}>
                  {toolsInfo.tool_type.map((tool, index) => (
                    <Tooltip title={t(tool)} key={index} arrow>
                      <Chip label={toolsInfo.function_names[index] + "()"} />
                    </Tooltip>
                  ))}
                </Stack>
              </ToolsUsedBox>
            )}

            {!isLoading &&
              processedContent.citedCitations &&
              processedContent.citedCitations.length > 0 && (
                <>
                  <Divider />
                  <Box sx={{ m: 2, maxWidth: "100%" }}>
                    <Typography gutterBottom variant="subtitle2">
                      Citation(s):
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      {context?.citations.map((citation, index) => {
                        const docNumber = index + 1; // Convert index to docNumber
                        const newCitationNumber =
                          citationNumberMapping[docNumber]; // Get the new citation number
                        return (
                          processedContent.citedCitations.includes(
                            citation
                          ) && (
                            <Fragment key={index}>
                              <Chip
                                label={
                                  newCitationNumber + " - " + citation.title
                                } // Use new citation number
                                component="a"
                                href={citation.url}
                                target="_blank"
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

            {!isLoading && profiles.length > 0 && (
              <ProfileCardsContainer
                profiles={profiles}
                isExpanded={profilesExpanded}
                toggleShowProfileHandler={handleToggleShowProfiles}
              />
            )}

            {floorPlanFilename && (
              <>
                <FloorPlanView
                  sx={{
                    display: "flex",
                    flex: "1",
                    width: {
                      xs: "300px",
                      sm: "450px",
                      md: "600px",
                      lg: "800px",
                    },
                    position: "relative",
                  }}
                >
                  <IconButton
                    sx={{
                      position: "absolute",
                      top: "0px",
                      right: "0px",
                      zIndex: 10,
                      color: "black",
                    }}
                    aria-label={t("aria.expand.floorPlan")}
                    onClick={() => setFloorPlanExpanded(true)}
                  >
                    <FitScreenIcon sx={{ fontSize: "30px" }} />
                  </IconButton>
                  <img src={floorPlanFilename} alt={t("archibus.floorPlan")} />
                </FloorPlanView>

                <Dialog
                  open={isFloorPlanExpanded}
                  onClose={() => setFloorPlanExpanded(false)}
                  PaperComponent={DraggablePaperComponent}
                  aria-labelledby="draggable-dialog-title"
                  fullWidth
                  maxWidth="md"
                  disableScrollLock
                >
                  <DialogTitle
                    style={{ cursor: "move", height: "50px" }}
                    id="draggable-dialog-title"
                  ></DialogTitle>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <img
                      src={floorPlanFilename}
                      alt={t("archibus.floorPlan")}
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        padding: "0px 50px 50px 50px",
                      }}
                    />
                  </div>
                </Dialog>
              </>
            )}

            {bookingDetails && (
              <ConfirmBookingBox>
                <Button
                  disabled={confirmButtonDisabled}
                  sx={{
                    fontSize: "20px",
                    color: "white",
                    borderRadius: "5px",
                    backgroundColor: "primary.main",
                    height: "40px",
                    width: "80%",
                    maxWidth: "400px",
                    padding: "40px",
                    "&:hover": {
                      boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.3)",
                      backgroundColor: "#261F4C",
                    },
                    "&:disabled": {
                      backgroundColor: "grey",
                      color: "white",
                    },
                  }}
                  onClick={handleConfirmButtonClicked}
                >
                  {t("booking.complete")}
                </Button>
              </ConfirmBookingBox>
            )}

            {!isLoading && (brData || brUpdates) && (
              <>
                <Divider />
                <Box
                  sx={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(min(500px, 100%), 1fr))",
                    gap: 1,
                    marginTop: 2,
                  }}
                >
                  {brData &&
                    brData.map((item, index) => (
                      <BusinessRequestCard
                        key={index}
                        data={item}
                        lang={i18n.language}
                      />
                    ))}

                  {brUpdates && (
                    <BusinessRequestUpdates
                      data={brUpdates}
                      lang={i18n.language}
                    />
                  )}
                </Box>
              </>
            )}
          </ChatBubbleInner>
        </Box>
        <Box>
          {total > 1 && index! != 0 && (
            <Paper
              sx={{
                backgroundColor: "transparent",
                boxShadow: "none",
                mt: 1,
                ml: 2,
              }}
            >
              <BubbleButtons
                setIsFeedbackVisible={setIsFeedbackVisible}
                setIsGoodResponse={setIsGoodResponse}
                isHovering={isHovering}
                isMostRecent={isMostRecent}
                replayChat={replayChat}
                text={text}
              />
            </Paper>
          )}
        </Box>
      </ChatBubbleView>
    </ChatBubbleWrapper>
  );
};

const ChatBubbleWrapper = styled(Box)`
  display: flex;
  width: 95%;
`;

const ChatBubbleView = styled(Box)`
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: flex-start;
`;

const ChatBubbleInner = styled(Paper)(() => ({
  borderRadius: 0,
  boxShadow: "none",
  flexDirection: "row",
  maxWidth: "95%",
}));

const ToolsUsedBox = styled(Box)`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 10px 15px;
`;

const MainContentWrapper = styled(Box)`
  display: flex;
  padding: 0px 15px;
`;

const IconWrapper = styled(Box)`
  margin: 18px 12px 8px 0px;
`;

const TextComponentsBox = styled(Box)`
  max-width: 95%;

  code {
    max-width: 95%;
    padding-right: 15px;
    background-color: white;
    overflow-x: auto;
    padding: 4px 2px;
    margin: 5px 5px 5px 0px;
  }
`;

const FloorPlanView = styled(Box)({
  margin: "20px 30px",
});

const ConfirmBookingBox = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 30px;
`;
