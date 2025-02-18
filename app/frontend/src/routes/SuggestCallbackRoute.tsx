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
    has_suggestions: z.boolean(),
    language: z.enum(["en", "fr"]),
    original_query: z.string(),
    timestamp: z.string().datetime(),
    requester: z.string(),
    content: z.string(),
    citations: z.array(CitationSchema)
});

const SuggestionContextFailureSchema = z.object({
    has_suggestions: z.boolean(),
    reason: z.string()
});

const SuggestionContextSchema = z.union([SuggestionContextSuccessSchema, SuggestionContextFailureSchema]);

export type SuggestionContext = z.infer<typeof SuggestionContextSchema>;

enum SuggestCallbackErrorStates {
    REDIRECT_WITH_UNKNOWN_ERROR = "redirect_with_unknown_error",
    REDIRECT_BECAUSE_SERVER_RETURNED_SUCCESS_FALSE = "redirect_because_server_returned_success_false",
    REDIRECT_BECAUSE_CONTEXT_VALIDATION_FAILED = "redirect_because_context_validation_failed"
}

enum SuggestCallbackSuccessStates {
    REDIRECT_WITH_SUCCESS = "redirect_with_success",
};

export type SuggestCallbackStates = SuggestCallbackErrorStates | SuggestCallbackSuccessStates;

type ParsedContextParamReturn =
    | { success: true, context: SuggestionContext }
    | { success: false, errorReason: SuggestCallbackErrorStates };

const parseContextParam = (context: string | undefined): ParsedContextParamReturn => {
    if (!context) {
        return {
            success: false,
            errorReason: SuggestCallbackErrorStates.REDIRECT_BECAUSE_CONTEXT_VALIDATION_FAILED
        }
    }

    try {
        const parsed = SuggestionContextSchema.parse(JSON.parse(context));
        return {
            success: true,
            context: parsed
        }
    } catch (e) {
        return {
            success: false,
            errorReason: SuggestCallbackErrorStates.REDIRECT_BECAUSE_CONTEXT_VALIDATION_FAILED
        }
    }
}

const useParsedContextParam = () => {
    const { context } = useParams();
    const [contextCache, setContextCache] = useState<ParsedContextParamReturn | null>(null);

    useEffect(() => {
        setContextCache(parseContextParam(context));
    }, [context]);

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
                    errorReason: SuggestCallbackErrorStates.REDIRECT_WITH_UNKNOWN_ERROR
                };
        }
    })()

    return (
        <div>
            <div data-testid="val.success">
                <div>Success:</div>
                <div>{massagedValue.success.toString()}</div>
            </div>
            {massagedValue.success ? (
                <div data-testid="val.context">
                    <div>{JSON.stringify(massagedValue.context)}</div>
                </div>
            )
                : (
                    <div data-testid="val.errorReason">
                        <div>{massagedValue.errorReason}</div>
                    </div>
                )
            }
        </div>
    )
}



// export const SuggestCallbackRoute: FC = () => {
//     const { context } = useParams();

//     return (
//         <div>Suggest Callback</div>
//     )
// }