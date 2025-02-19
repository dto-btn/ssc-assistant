import { useParams, useSearchParams } from "react-router";
import { FC, useEffect, useState } from "react"
import z from "zod";

// Added schemas
const CitationSchema = z.object({
    title: z.string(),
    url: z.string(),
    content: z.string()
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

type ParsedContextParamReturn =
    | { success: true, context: SuggestionContext }
    | { success: false, errorReason: SuggestCallbackStates };

const parseContextParam = (contextBase64: string | null): ParsedContextParamReturn => {
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
    const [returnVal, setReturnVal] = useState<ParsedContextParamReturn | null>(null);

    useEffect(() => {
        const contextCache = parseContextParam(suggestionContext);

        const massagedValue = ((): ParsedContextParamReturn => {
            switch (contextCache?.success) {
                case true:
                    return {
                        success: true,
                        context: contextCache.context
                    };
                case false:
                    return {
                        success: false,
                        errorReason: contextCache.errorReason
                    };
                default:
                    return {
                        success: false,
                        errorReason: "redirect_with_unknown_error"
                    };
            }
        })();

        setReturnVal(massagedValue);
    }, []);

    return returnVal;
}

const generateTestLink = () => {
    const suggestionContext = btoa(JSON.stringify({
        "success": true,
        "language": "en",
        "original_query": "What is SSC's content management system?",
        "timestamp": "2022-01-01T00:00:00.000Z",
        "requester": "mysscplus",
        "content": "Arr, ye be askin' about the content management system at SSC. Here be what I found... Those pesky citations be removed, but ye can still find them in the citations list.",
        "citations": [
            {
                "title": "Title of the citation",
                "content": "Example",
                "url": "https://example.com",
            },
            {
                "title": "Duplicate Example",
                "content": "It can contain duplicates, but you can use the dedupe_citations option to remove them.",
                "url": "https://example.com/duplicate",
            },
        ],
    }));

    const link = `http://localhost:8080/suggest-callback?suggestionContext=${suggestionContext}`;

    return link;
}



export const SuggestCallbackRoute: FC = () => {
    const massagedValue = useParsedContextParam();
    const testLink = generateTestLink();

    if (!massagedValue) {
        return <div>Loading...</div>
    }

    if (massagedValue.success) {
        return (
            <div>
                <div data-testid="val.success.true">
                    Success!
                </div>
                <div data-testid="val.context">
                    <div>{JSON.stringify(massagedValue.context)}</div>
                </div>
                <a href={testLink}>Test Link</a>
            </div>
        )
    } else {
        return (
            <div>
                <div data-testid="val.success.false">
                    Failure. Reason...:
                </div>
                <div data-testid="val.errorReason">
                    <div>{massagedValue.errorReason}</div>
                </div>
                <a href={testLink}>Test Link</a>
            </div>
        )
    }
}