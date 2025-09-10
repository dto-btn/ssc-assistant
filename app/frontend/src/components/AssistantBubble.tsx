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
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
} from "@mui/material";
import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeMermaid from "rehype-mermaid";
import rehypeMathjax from "rehype-mathjax";
import "highlight.js/styles/github.css";
import { useEffect, useState, Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BubbleButtons } from "./BubbleButtons";
import { styled } from "@mui/system";
import ProfileCardsContainer from "../containers/ProfileCardsContainer";
import HandymanIcon from "@mui/icons-material/Handyman";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { visuallyHidden } from "@mui/utils";
import Draggable from "react-draggable";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BusinessRequestCard from "./BusinessRequests/BusinessRequestCard";
import { transformToBusinessRequest } from "../util/bits_utils";
import BusinessRequestTable from "./BusinessRequests/BusinessRequestTable";
import BusinessRequestMetadata from "./BusinessRequests/BusinessRequestMetadata";

interface AssistantBubbleProps {
  text: string;
  isLoading: boolean;
  context?: Context | null;
  toolsInfo?: ToolInfo[];
  scrollRef?: React.RefObject<HTMLDivElement>;
  replayChat: () => void;
  index: number;
  total: number;
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
  handleBookReservation,
}: AssistantBubbleProps) => {
  const { t, i18n } = useTranslation();
  const [processedContent, setProcessedContent] = useState({
    processedText: "",
    citedCitations: [] as Citation[],
  });
  const [_, setProcessingComplete] = useState(false);
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
  const [brData, setBrData] = useState<BusinessRequest[] | undefined>(
    undefined
  );
  // Define an interface for the brQuery structure
  interface BrQueryFilter {
    name: string;
    en: string;
    fr: string;
    operator: string;
    value: string | number;
  }

  interface BrQueryType {
    query_filters?: BrQueryFilter[];
    status?: string;
    statuses?: string[];
    limit?: number;
    [key: string]: any; // Allow for other properties we might not know about
  }

  interface BrSelectFields {
    fields: string[];
  }

  const [brQuery, setBrQuery] = useState<BrQueryType | undefined>(undefined);
  const [brSelectFields, setBrSelectFields] = useState<
    BrSelectFields | undefined
  >(undefined);

  // Intercept inline anchors that match a cited URL to show drawer instead
  const components = useMemo(
    () => ({
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <Link
          target="_blank"
          rel="noopener noreferrer"
          {...props}
          onClick={(e) => {
            // Allow ctrl/cmd/middle-click to open in a new tab normally
            if (e.ctrlKey || (e as any).metaKey || (e as any).button === 1)
              return;
            const href = props.href;
            if (href && openCitationByUrl(href)) {
              e.preventDefault();
            }
            props.onClick?.(e);
          }}
        />
      ),
    }),
    [processedContent.citedCitations]
  );
  const [citationNumberMapping, setCitationNumberMapping] = useState<{
    [key: number]: number;
  }>({});
  const [brMetadata, setBrMetadata] = useState<BrMetadata | undefined>();

  // Helper to safely decode URI, preserving original on failure
  const safeDecode = (url: string) => {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  };

  // Group cited citations by normalized URL
  const groupedCitations = useMemo(() => {
    const groups = new Map<
      string,
      {
        url: string;
        title: string;
        citations: Citation[];
        displayNumber: number;
      }
    >();
    if (!processedContent.citedCitations?.length)
      return [] as Array<{
        url: string;
        title: string;
        citations: Citation[];
        displayNumber: number;
      }>;
    processedContent.citedCitations.forEach((c) => {
      const key = safeDecode(c.url);
      const existing = groups.get(key);
      if (!existing) {
        const fullIndex =
          context?.citations?.findIndex((all) => all === c) ?? -1;
        const docNum = fullIndex >= 0 ? fullIndex + 1 : undefined;
        const disp = docNum
          ? citationNumberMapping[docNum]
          : Number.MAX_SAFE_INTEGER;
        groups.set(key, {
          url: key,
          title: c.title || key,
          citations: [c],
          displayNumber: disp,
        });
      } else {
        existing.citations.push(c);
        const fullIndex =
          context?.citations?.findIndex((all) => all === c) ?? -1;
        const docNum = fullIndex >= 0 ? fullIndex + 1 : undefined;
        const disp = docNum
          ? citationNumberMapping[docNum]
          : Number.MAX_SAFE_INTEGER;
        if (disp < existing.displayNumber) existing.displayNumber = disp;
      }
    });
    return Array.from(groups.values()).sort(
      (a, b) => a.displayNumber - b.displayNumber
    );
  }, [
    processedContent.citedCitations,
    context?.citations,
    citationNumberMapping,
  ]);
  // Citation drawer state
  const [isCitationDrawerOpen, setCitationDrawerOpen] = useState(false);
  const [activeCitationGroupUrl, setActiveCitationGroupUrl] = useState<
    string | undefined
  >(undefined);
  const isSmall = useMediaQuery("(max-width:900px)");

  // Helper: open drawer by URL found in inline links
  const openCitationByUrl = (url?: string) => {
    if (!url || !processedContent.citedCitations?.length) return false;
    const decoded = safeDecode(url);
    const has = processedContent.citedCitations.some(
      (c) => safeDecode(c.url) === decoded || encodeURI(c.url) === url
    );
    if (has) {
      setActiveCitationGroupUrl(decoded);
      setCitationDrawerOpen(true);
      return true;
    }
    return false;
  };

  function processText(text: string, citations: Citation[]) {
    // Regular expression to find all citation references like [doc1], [doc3], etc.
    const citationRefRegex = /\[doc(\d+)\]/g;

    // Map to store the new citation numbers
    const citationNumberMapping: { [key: number]: number } = {};

    // Identify the cited citations and create the citationNumberMapping
    citations.forEach((_, index) => {
      const docNumber = index + 1; // Convert index to docNumber
      if (text.includes(`[doc${docNumber}]`)) {
        citationNumberMapping[docNumber] =
          Object.keys(citationNumberMapping).length + 1;
      }
    });

    // Filter the citations array to only include the cited documents
    const citedCitations = citations.filter((_, index) => {
      const docNumber = index + 1; // Convert index to docNumber
      return citationNumberMapping[docNumber];
    });

    // Replace citation references with Markdown links using the new citation numbers
    const processedText = text.replace(citationRefRegex, (_, docNumber) => {
      const citation = citations[parseInt(docNumber, 10) - 1];
      if (citation && citation.url) {
        // Encode spaces and other unsafe chars; wrap with <> to be robust for parentheses
        const encodedUrl = encodeURI(citation.url);
        const newCitationNumber =
          citationNumberMapping[parseInt(docNumber, 10)];
        return ` [${newCitationNumber}](<${encodedUrl}>)`;
      }
      return "";
    });

    return { processedText, citedCitations, citationNumberMapping };
  }

  const processProfiles = (employeeProfiles: EmployeeProfile[]) => {
    const processedProfiles: EmployeeProfile[] = [];

    employeeProfiles.forEach((profile) => {
      // Clone the profile to ensure it is extensible
      const extensibleProfile = { ...profile };

      if (
        text.includes(extensibleProfile.email) ||
        (extensibleProfile.phone && text.includes(extensibleProfile.phone))
      ) {
        extensibleProfile.matchedProfile = true;
      } else {
        extensibleProfile.matchedProfile = false;
      }

      processedProfiles.push(extensibleProfile);
    });

    return processedProfiles;
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
    if (toolsInfo && toolsInfo.length > 0) {
      toolsInfo.map((tool) => {
        const payload = tool.payload;
        // BRs
        if (payload?.br) {
          try {
            const brInformation = payload.br;
            if (brInformation.length) {
              const brInfoTransformed = brInformation.map((br: any) => {
                return transformToBusinessRequest(br);
              });
              setBrData(brInfoTransformed);
            }
            if (payload?.metadata) {
              setBrMetadata(payload.metadata);
            }
          } catch (error) {
            console.error(
              "Error transforming BR data and/or BR metadata",
              error
            );
          }
        }

        // BR Query
        if (payload?.brquery) {
          setBrQuery(payload.brquery); // This is already an object from the payload
        }

        // BR Select Fields
        if (payload?.brselect) {
          setBrSelectFields(payload.brselect); // This is already an object from the payload
        }

        // GEDS
        if (payload?.profiles) {
          console.log("Profiles: ", payload.profiles);
          const processedProfiles = processProfiles(payload.profiles);
          setProfiles(processedProfiles);
        }

        //ARCHIBUS
        if (payload?.floorPlan) {
          setFloorPlanFilename(payload.floorPlan);
        }

        if (payload?.bookingDetails) {
          setBookingDetails(payload.bookingDetails);
        }
      });
    }
  }, [toolsInfo, text]);

  // useEffect(
  //   () =>
  //     processingComplete
  //       ? scrollRef?.current?.scrollIntoView({ behavior: "smooth" })
  //       : undefined,
  //   [processingComplete, scrollRef]
  // );

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
                <MarkdownHooks
                  components={components}
                  rehypePlugins={[
                    rehypeHighlight,
                    rehypeMathjax,
                    [
                      rehypeMermaid,
                      {
                        // Ensure the fallback actually renders
                        errorFallback: () => <div>Invalid diagram format!</div>,
                      },
                    ],
                  ]}
                  remarkPlugins={[remarkGfm]}
                >
                  {isLoading
                    ? `${text.replace(/\[doc(\d+)\]/g, "")}_`
                    : processedContent.processedText !== ""
                      ? processedContent.processedText
                      : text}
                </MarkdownHooks>
              </TextComponentsBox>
            </MainContentWrapper>

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
                      {groupedCitations.map((group, index) => (
                        <Fragment key={group.url + index}>
                          <Chip
                            label={`${group.title}`}
                            component="a"
                            href={encodeURI(group.url)}
                            target="_blank"
                            variant="filled"
                            clickable
                            color="primary"
                            onClick={(e) => {
                              if (
                                e.ctrlKey ||
                                (e as any).metaKey ||
                                (e as any).button === 1
                              )
                                return;
                              e.preventDefault();
                              setActiveCitationGroupUrl(group.url);
                              setCitationDrawerOpen(true);
                            }}
                          />
                        </Fragment>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}

            {processedContent.citedCitations &&
              processedContent.citedCitations.length > 0 && (
                <Drawer
                  anchor={isSmall ? "bottom" : "right"}
                  open={isCitationDrawerOpen}
                  onClose={() => setCitationDrawerOpen(false)}
                  PaperProps={{
                    sx: { width: isSmall ? "100%" : 420, maxWidth: "100%" },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1,
                      pl: 2,
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle1">Citations</Typography>
                    <IconButton
                      id="close-citation-drawer-button"
                      aria-label={t("aria.close") as string}
                      onClick={() => setCitationDrawerOpen(false)}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ p: 1 }}>
                    {groupedCitations.map((group) => (
                      <Accordion
                        key={group.url}
                        expanded={
                          activeCitationGroupUrl
                            ? activeCitationGroupUrl === group.url
                            : undefined
                        }
                        onChange={(_, expanded) => {
                          if (expanded) setActiveCitationGroupUrl(group.url);
                          else setActiveCitationGroupUrl(undefined);
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">
                            {group.title}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            Source:{" "}
                            <Link
                              href={encodeURI(group.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {group.url}
                            </Link>
                          </Typography>
                          <Box
                            sx={{
                              mt: 1,
                              maxHeight: isSmall ? 240 : 520,
                              overflow: "auto",
                              pr: 1,
                            }}
                          >
                            {group.citations.map((c, idx) => {
                              const fullIndex =
                                context?.citations?.findIndex(
                                  (all) => all === c
                                ) ?? -1;
                              const docNum =
                                fullIndex >= 0 ? fullIndex + 1 : undefined;
                              const mappedNum = docNum
                                ? citationNumberMapping[docNum]
                                : undefined;
                              return (
                                <>
                                  {mappedNum !== undefined && (
                                    <Typography
                                      variant="h4"
                                      sx={{
                                        fontWeight: 600,
                                        display: "block",
                                        mb: 0.5,
                                      }}
                                    >
                                      {mappedNum}.
                                    </Typography>
                                  )}
                                  <Box
                                    key={idx}
                                    sx={{
                                      mb: 1.5,
                                      p: 1.5,
                                      borderRadius: 1,
                                      bgcolor: "#f4f1ff",
                                      border: "1px solid #e1dbff",
                                    }}
                                    id={
                                      mappedNum
                                        ? `citation-${mappedNum}`
                                        : undefined
                                    }
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ whiteSpace: "pre-wrap" }}
                                    >
                                      {c.content}
                                    </Typography>
                                  </Box>
                                </>
                              );
                            })}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>
                </Drawer>
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
                    id="expand-floorplan-button"
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
                  id="confirm-booking-button"
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
              <>
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
                  {brData && brData.length > 1 && (
                    <Box sx={{ gridColumn: "span 2" }}>
                      <BusinessRequestTable
                        data={brData}
                        lang={i18n.language}
                        show_fields={
                          brSelectFields ? brSelectFields.fields : []
                        }
                      />
                    </Box>
                  )}

                  {brData &&
                    brData.length == 1 &&
                    brData.map((item, index) => (
                      <Box
                        sx={{
                          gridColumn: "span 2",
                          display: "flex",
                          justifyContent: "left",
                        }}
                      >
                        <BusinessRequestCard
                          key={index}
                          data={item}
                          lang={i18n.language}
                        />
                      </Box>
                    ))}
                  {brMetadata && (
                    <BusinessRequestMetadata metadata={brMetadata} />
                  )}
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
            {/* Combined tools and query parameters section */}
            {(toolsInfo && toolsInfo.length > 0) || (brQuery && !isLoading) ? (
              <ToolsUsedBox>
                <Paper
                  sx={{ backgroundColor: "white", padding: 1, width: "100%" }}
                  elevation={3}
                >
                  <Typography
                    variant="caption"
                    gutterBottom
                    sx={{ display: "block", mb: 1 }}
                  >
                    {t("toolsUsed.short")}:
                  </Typography>

                  {/* Tools section */}
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ mb: toolsInfo && brQuery ? 1 : 0 }}
                  >
                    {toolsInfo &&
                      toolsInfo.map((tool, index) => (
                        <Tooltip
                          title={t(tool.function_name)}
                          key={index}
                          arrow
                        >
                          <Chip
                            icon={
                              <HandymanIcon
                                style={{
                                  fontSize: 16,
                                  color: "#4b3e99",
                                }}
                              />
                            }
                            label={`${tool.function_name}()`}
                            size="small"
                          />
                        </Tooltip>
                      ))}
                  </Stack>

                  {/* Query parameters section */}
                  {!isLoading && brQuery && (
                    <>
                      {/* Only show divider if both tools and query params exist */}
                      {toolsInfo && toolsInfo.length > 0 && (
                        <Divider sx={{ my: 1 }} />
                      )}

                      <Typography
                        variant="caption"
                        gutterBottom
                        sx={{ display: "block", mb: 1 }}
                      >
                        Query Parameters:
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                      >
                        {/* Query Filters */}
                        {brQuery.query_filters &&
                          brQuery.query_filters.length > 0 &&
                          brQuery.query_filters.map((filter, index) => (
                            <Chip
                              key={index}
                              label={`${i18n.language == "en" ? filter.en : filter.fr
                                } (${filter.name}) ${filter.operator} ${filter.value
                                }`}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}

                        {/* Status - only if it has value */}
                        {brQuery.status && (
                          <Chip
                            label={`Status: ${brQuery.status}`}
                            size="small"
                            variant="outlined"
                            color="secondary"
                          />
                        )}

                        {/* Statuses array - only if it has values */}
                        {brQuery.statuses &&
                          Array.isArray(brQuery.statuses) &&
                          brQuery.statuses.length > 0 && (
                            <Chip
                              label={`Statuses: ${brQuery.statuses.join(", ")}`}
                              size="small"
                              variant="outlined"
                              color="secondary"
                            />
                          )}
                      </Stack>
                    </>
                  )}
                </Paper>
              </ToolsUsedBox>
            ) : null}
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
  padding: 1em;
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

  /* Mermaid diagram sizing fix */
  svg[id^="mermaid-"] {
    width: 100% !important;
    height: auto !important;
    max-width: 100%;
    display: block;
    margin: 0 auto;
    min-height: 600px;
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
