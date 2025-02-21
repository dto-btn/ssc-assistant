import { useSearchParams, useNavigate } from "react-router";
import { FC, useEffect, useState } from "react"
import z from "zod";

// Test links

// SUCCESS
// http://localhost:8080/suggest-callback?suggestionContext=eyJzdWNjZXNzIjp0cnVlLCJsYW5ndWFnZSI6ImVuIiwib3JpZ2luYWxfcXVlcnkiOiJXaGF0IGlzIFNTQydzIGNvbnRlbnQgbWFuYWdlbWVudCBzeXN0ZW0/IiwidGltZXN0YW1wIjoiMjAyMi0wMS0wMVQwMDowMDowMC4wMDBaIiwicmVxdWVzdGVyIjoibXlzc2NwbHVzIiwiY29udGVudCI6IkFyciwgeWUgYmUgYXNraW4nIGFib3V0IHRoZSBjb250ZW50IG1hbmFnZW1lbnQgc3lzdGVtIGF0IFNTQy4gSGVyZSBiZSB3aGF0IEkgZm91bmQuLi4gVGhvc2UgcGVza3kgY2l0YXRpb25zIGJlIHJlbW92ZWQsIGJ1dCB5ZSBjYW4gc3RpbGwgZmluZCB0aGVtIGluIHRoZSBjaXRhdGlvbnMgbGlzdC4iLCJjaXRhdGlvbnMiOlt7InRpdGxlIjoiVGl0bGUgb2YgdGhlIGNpdGF0aW9uIiwidXJsIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9LHsidGl0bGUiOiJEdXBsaWNhdGUgRXhhbXBsZSIsInVybCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vZHVwbGljYXRlIn1dfQ==

// NO CONTEXT
// http://localhost:8080/suggest-callback

// SUCCESS FALSE
// http://localhost:8080/suggest-callback?suggestionContext=eyJzdWNjZXNzIjpmYWxzZSwicmVhc29uIjoicmVkaXJlY3RfYmVjYXVzZV9zZXJ2ZXJfcmV0dXJuZWRfc3VjY2Vzc19mYWxzZSJ9

// VALIDATION FAILED
// http://localhost:8080/suggest-callback?suggestionContext=eyJzdWNjZXNzIjp0cnVlLCJidXQiOiJ0aGlzIGlzIGdhcmJhZ2UgZGF0YSJ9


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

export const SuggestCallbackRoute: FC = () => {
    const parsedContext = useParsedContextParam();

    const navigate = useNavigate();

    useEffect(() => {
        if (!parsedContext) {
            return;
        }
        navigate('/', {
            state: parsedContext
        })
    }, [parsedContext])

    return (
        <></>
    )
}