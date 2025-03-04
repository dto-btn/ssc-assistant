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
  const [brData, setBrData] = useState<BusinessRequest | undefined>(undefined);
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

  const transformToBusinessRequest = (data: any) => {
    return {
      BR_NMBR: data.BR_NMBR,
      BR_TITLE: data.BR_TITLE,
      BR_SHORT_TITLE: data.BR_SHORT_TITLE,
      PRIORITY_EN: data.PRIORITY_EN,
      PRIORITY_FR: data.PRIORITY_FR,
      CLIENT_NAME_SRC: data.CLIENT_NAME_SRC,
      RPT_GC_ORG_NAME_EN: data.RPT_GC_ORG_NAME_EN,
      RPT_GC_ORG_NAME_FR: data.RPT_GC_ORG_NAME_FR,
      ORG_TYPE_EN: data.ORG_TYPE_EN,
      ORG_TYPE_FR: data.ORG_TYPE_FR,
      CLIENT_SUBGRP_ID: data.CLIENT_SUBGRP_ID,
      CLIENT_SUBGRP_EN: data.CLIENT_SUBGRP_EN,
      CLIENT_SUBGRP_FR: data.CLIENT_SUBGRP_FR,
      CREATE_DATE: data.CREATE_DATE,
      SUBMIT_DATE: data.SUBMIT_DATE,
      DAYS_SINCE_SUBMIT: data.DAYS_SINCE_SUBMIT,
      REQST_IMPL_DATE: data.REQST_IMPL_DATE,
      TARGET_IMPL_DATE: data.TARGET_IMPL_DATE,
      RVSD_TARGET_IMPL_DATE: data.RVSD_TARGET_IMPL_DATE,
      ACTUAL_IMPL_DATE: data.ACTUAL_IMPL_DATE,
      DAYS_TO_IMPL: data.DAYS_TO_IMPL,
      CANCEL_REASON_EN: data.CANCEL_REASON_EN,
      CANCEL_REASON_FR: data.CANCEL_REASON_FR,
      HOLD_REASON_EN: data.HOLD_REASON_EN,
      HOLD_REASON_FR: data.HOLD_REASON_FR,
      GROUP_ID: data.GROUP_ID,
      GROUP_EN: data.GROUP_EN,
      GROUP_FR: data.GROUP_FR,
      REGION_ACRN_EN: data.REGION_ACRN_EN,
      REGION_ACRN_FR: data.REGION_ACRN_FR,
      REGION_EN: data.REGION_EN,
      REGION_FR: data.REGION_FR,
      BR_TYPE_EN: data.BR_TYPE_EN,
      BR_TYPE_FR: data.BR_TYPE_FR,
      FUNDING_TYPE_EN: data.FUNDING_TYPE_EN,
      FUNDING_TYPE_FR: data.FUNDING_TYPE_FR,
      CPLX_EN: data.CPLX_EN,
      CPLX_FR: data.CPLX_FR,
      SCOPE_EN: data.SCOPE_EN,
      SCOPE_FR: data.SCOPE_FR,
      BR_OWNER: data.BR_OWNER,
      BR_INITR: data.BR_INITR,
      BR_LAST_EDITOR: data.BR_LAST_EDITOR,
      CSM_OPI: data.CSM_OPI,
      TL_OPI: data.TL_OPI,
      CSM_DIRTR: data.CSM_DIRTR,
      SOL_OPI: data.SOL_OPI,
      ENGN_OPI: data.ENGN_OPI,
      BA_OPI: data.BA_OPI,
      BA_TL: data.BA_TL,
      PM_OPI: data.PM_OPI,
      BA_PRICE_OPI: data.BA_PRICE_OPI,
      QA_OPI: data.QA_OPI,
      SL_COORD: data.SL_COORD,
      AGRMT_OPI: data.AGRMT_OPI,
      ACCT_MGR_OPI: data.ACCT_MGR_OPI,
      SDM_TL_OPI: data.SDM_TL_OPI,
      REQMT_OVRVW: data.REQMT_OVRVW,
      ASSOC_BRS: data.ASSOC_BRS,
    };
  };

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
      if (toolsInfo?.payload?.get_br_information) {
        setBrData(
          transformToBusinessRequest(toolsInfo.payload.get_br_information[0])
        );
      }

      if (toolsInfo?.payload?.get_br_updates?.length) {
        setBrUpdates(toolsInfo.payload.get_br_updates);
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
    <ChatBubbleWrapper tabIndex={0}>
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
                      margin: "0px 8px 3px 0px",
                      color: "#4b3e99",
                    }}
                  />
                </Tooltip>
                <Typography
                  sx={{
                    fontSize: "15px",
                    padding: "0px 22px 3px 0px",
                    color: "primary.main",
                  }}
                >
                  {toolsInfo.tool_type.map((tool, index) => (
                    <span key={index}>
                      {t(tool)}
                      {index < toolsInfo.tool_type.length - 1 && ", "}
                    </span>
                  ))}
                </Typography>
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

            {!isLoading && brData && (
              <BusinessRequestCard data={brData} lang={i18n.language} />
            )}

            {!isLoading && brUpdates && (
              <BusinessRequestUpdates data={brUpdates} lang={i18n.language} />
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
