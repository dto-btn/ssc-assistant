import { useSearchParams, useNavigate } from "react-router";
import React, { FC, PropsWithChildren, useEffect, useState } from "react"
import z from "zod";
import { Box, Button } from "@mui/material";
import { TopMenuFrame } from "../components/TopMenu/subcomponents/TopMenuFrame";

// Added schemas
const CitationSchema = z.object({
    title: z.string(),
    url: z.string(),
});

const SuggestionContextSuccessSchema = z.object({
    success: z.literal(true),
    language: z.enum(["en", "fr"]),
    original_query: z.string(),
    timestamp: z.string().datetime(),
    requester: z.string(),
    content: z.string(),
    citations: z.array(CitationSchema)
});

const SuggestionContextFailureSchema = z.object({
    success: z.literal(false),
    reason: z.string()
});

const SuggestionContextSchema = z.discriminatedUnion("success", [SuggestionContextSuccessSchema, SuggestionContextFailureSchema]);

export type SuggestionContext = z.infer<typeof SuggestionContextSchema>;

export type SuggestCallbackStates = "redirect_with_unknown_error" | "redirect_because_server_returned_success_false" | "redirect_because_context_validation_failed" | "redirect_with_success";

export type ParsedSuggestionContext =
    | { success: true, context: SuggestionContext }
    | { success: false, errorReason: SuggestCallbackStates };

const validateContextParam = (contextBase64: string | null): ParsedSuggestionContext => {
    if (!contextBase64) {
        console.error("parseContextParam: context is undefined");
        return {
            success: false,
            errorReason: "redirect_because_context_validation_failed"
        }
    }

    try {
        const contextStringified = atob(contextBase64);
        const parsed = SuggestionContextSchema.parse(JSON.parse(contextStringified));

        if (parsed.success) {
            return {
                success: true,
                context: parsed
            }
        } else {
            console.error("parseContextParam: server returned success: false");
            return {
                success: false,
                errorReason: "redirect_because_server_returned_success_false"
            }
        }
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.error("parseContextParam: Zod validation failed", e.errors);
            return {
                success: false,
                errorReason: "redirect_because_context_validation_failed"
            }
        }

        // Log the error
        console.error("Unknown error while parsing SuggestionContext", e);
        return {
            success: false,
            errorReason: "redirect_because_context_validation_failed"
        }
    }
}

const useParsedContextParam = () => {
    const [urlParams] = useSearchParams();
    const suggestionContext = urlParams.get("suggestionContext")
    const [returnVal, setReturnVal] = useState<ParsedSuggestionContext | null>(null);

    useEffect(() => {
        const validatedContext = validateContextParam(suggestionContext);
        setReturnVal(validatedContext);
    }, [suggestionContext]);

    return returnVal;
}

const generateTestLink = (suggestionContext: SuggestionContext) => {
    const b64 = btoa(JSON.stringify(suggestionContext));
    const link = `${window.location.origin}/suggest-callback?suggestionContext=${b64}`;
    return link;
}

const GOOD_TEST_LINK = generateTestLink({
    "success": true,
    "language": "en",
    "original_query": "What is SSC's content management system?",
    "timestamp": "2022-01-01T00:00:00.000Z",
    "requester": "mysscplus",
    "content": "Arr, ye be askin' about the content management system at SSC. Here be what I found... Those pesky citations be removed, but ye can still find them in the citations list.",
    "citations": [
        {
            "title": "Title of the citation",
            "url": "https://example.com",
        },
        {
            "title": "Duplicate Example",
            "url": "https://example.com/duplicate",
        },
    ],
});

const NO_CONTEXT_LINK = `${window.location.origin}/suggest-callback`;

const SUCCESS_FALSE_LINK = generateTestLink({
    success: false,
    reason: "redirect_because_server_returned_success_false"
});

const VALIDATION_FAILED_LINK = generateTestLink({
    success: true,
    // @ts-expect-error we're testing the error case
    but: "this is garbage data"
});

const SuggestCallbackContainer: React.FC<PropsWithChildren<{ parsedContext: ParsedSuggestionContext | null }>> = ({ children, parsedContext: parsedSuggestionContext }) => {
    const navigate = useNavigate();

    const doNavigate = () => {
        navigate('/', {
            state: parsedSuggestionContext
        })
    }

    return (
        <>
            <TopMenuFrame />
            {children}
            <p>This page will be removed in the final version of the app. The function bound to the following button will be automatically triggered.</p>
            <Button data-testid="processContextBtn" variant="contained" onClick={() => doNavigate()}>Process Context</Button>
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", my: "2rem" }}>
                <h2>Test Links</h2>
                <a href={GOOD_TEST_LINK}>Success Link</a>
                <a href={NO_CONTEXT_LINK}>No Context Link</a>
                <a href={SUCCESS_FALSE_LINK}>Success False Link</a>
                <a href={VALIDATION_FAILED_LINK}>Validation Failed Link</a>
            </Box>
        </>
    )
}



export const SuggestCallbackRoute: FC = () => {
    const parsedContext = useParsedContextParam();

    if (!parsedContext) {
        return (
            <SuggestCallbackContainer parsedContext={parsedContext}>
                <div >Loading...</div>
            </SuggestCallbackContainer>
        )
    }

    if (parsedContext.success) {
        return (
            <SuggestCallbackContainer parsedContext={parsedContext}>
                <div data-testid="val.success.true">
                    Success! This call will be redirected to the chatbot, and a chat will be started with the suggestions.
                </div>
                <div data-testid="val.context">
                    Unbase64'd Data:
                    <pre style={{
                        whiteSpace: "pre-wrap",
                        wordWrap: "break-word",
                        fontFamily: "monospace"
                    }}>
                        {JSON.stringify(parsedContext, null, 2)}
                    </pre>
                </div>
            </SuggestCallbackContainer>
        )
    } else {
        return (
            <SuggestCallbackContainer parsedContext={parsedContext}>
                <div data-testid="val.success.false">
                    Failure. This call will be redirected to the chatbot, and an error message will be shown that corresponds to the following reason:
                </div>
                <div data-testid="val.errorReason">
                    <div>{parsedContext.errorReason}</div>
                </div>
            </SuggestCallbackContainer>
        )
    }
}