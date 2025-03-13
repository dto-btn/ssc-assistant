import { useSearchParams, useNavigate } from "react-router";
import { FC, useEffect, useState } from "react"
import z from "zod";
import { getSuggestionContext } from "../api/suggestionContext.api";
import { SuggestionContextResponseModel } from "../api/suggestionContext.models";


// This component is a route that is used to parse the suggestionContextId parameter from the URL.
// The suggestionContextId parameter is a UUID that references a suggestion that was made by a 3rd party service.
// The suggestionContextId is used to query the suggestion from the API by being passed as a parameter to the 
// GET /suggest endpoint.
// Currently, MySSC++ is the only 3rd party service that uses this route.

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

const doSuggestionContextApiQuery = async (suggestionContextId: string): Promise<SuggestionContextResponseModel> => {

    try {
        const suggestionContext = await getSuggestionContext({
            suggestionContextId: suggestionContextId
        });

        return suggestionContext;
    } catch (e) {
        console.error(e);
        return Promise.reject(e);
    }
}

const useParsedContextParam = () => {
    const [urlParams] = useSearchParams();
    const suggestionContextId = urlParams.get("suggestionContextId")
    const [returnVal, setReturnVal] = useState<SuggestionContextResponseModel | null>(null);
    const [errorVal, setErrorVal] = useState<SuggestCallbackStates | null>(null);

    useEffect(() => {
        setErrorVal(null);
        if (!suggestionContextId) {
            // todo: error handling
            setErrorVal("redirect_because_context_validation_failed");
            return;
        }
        doSuggestionContextApiQuery(suggestionContextId)
            .then((suggestionContext) => {
                setReturnVal(suggestionContext);
            })
            .catch((e) => {
                // todo: error handling
                console.error(e);
                setErrorVal("redirect_with_unknown_error");
            })
    }, [suggestionContextId]);

    return {
        suggestionContext: returnVal,
        error: errorVal
    };
}

export const SuggestCallbackRoute: FC = () => {
    const { suggestionContext, error } = useParsedContextParam();

    const navigate = useNavigate();

    useEffect(() => {
        if (error) {
            navigate("/", {
                state: {
                    success: false,
                    reason: "redirect_with_unknown_error"
                }
            })
            return;
        }

        if (!suggestionContext) {
            // this means there's an api call in progress
            return;
        }

        // success
        navigate('/', {
            state: {
                success: true,
                context: suggestionContext
            }
        })
    }, [suggestionContext, error, navigate])

    return (
        <></>
    )
}