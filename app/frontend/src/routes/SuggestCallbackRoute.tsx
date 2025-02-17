import { useParams } from "react-router";
import { FC, useEffect } from "react"
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

type SuggestionContext = z.infer<typeof SuggestionContextSchema>;

// const parseContextParam = (context: string): SuggestionContext | null => {
//     try {
//         const parsed = SuggestionContextSchema.parse(JSON.parse(context));
//         if (!parsed) {
//             return null;
//         }
//     } catch (e) {
//         return null;
//     }
// }

// const useParsedContextParam = () => {
//     const { context } = useParams();
//     const [contextCache, setContextCache] = useState<SuggestionContextSchema | null>(null);

//     useEffect(() => {
//         setContextCache(parseContextParam(context));
//     }, [context]);

//     return context;
// }

export const SuggestCallbackRoute: FC = () => {
    const { context } = useParams();

    return (
        <div>Suggest Callback</div>
    )
}