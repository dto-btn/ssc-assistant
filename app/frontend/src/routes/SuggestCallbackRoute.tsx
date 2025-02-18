import { useParams } from "react-router";
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

const parseContextParam = (context: string | undefined): ParsedContextParamReturn => {
    if (!context) {
        return {
            success: false,
            errorReason: "redirect_because_context_validation_failed"
        }
    }

    try {
        const parsed = SuggestionContextSchema.parse(JSON.parse(context));

        if (parsed.success) {
            return {
                success: true,
                context: parsed
            }
        } else {
            return {
                success: false,
                errorReason: "redirect_because_server_returned_success_false"
            }
        }
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.error("SuggestionContext validation failed", e.errors);
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
    const useParamsReturn = useParams();
    const { suggestionContext } = useParamsReturn;
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



export const SuggestCallbackRoute: FC = () => {
    const massagedValue = useParsedContextParam();

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
            </div>
        )
    }
}