import z from "zod";

const SafeCitationUrl = z.string().refine(
    (url) => {
        if (/[\u0000-\u001f\u007f\\]/.test(url)) return false;
        if (url.startsWith("/") && !url.startsWith("//")) return true;
        return /^https?:\/\//i.test(url) && z.string().url().safeParse(url).success;
    },
    { message: "Citation URL must be http(s) or app-relative" },
);

export const SuggestionContextSuccessSchema = z.object({
    success: z.literal(true),
    language: z.enum(["en", "fr"]),
    original_query: z.string(),
    timestamp: z.string().datetime(),
    requester: z.string(),
    content: z.string(),
    citations: z.array(
        z.object({
            title: z.string(),
            url: SafeCitationUrl
        })
    )
});

export const SuggestionContextFailureSchema = z.object({
    success: z.literal(false),
    reason: z.string().nullish()
});

export const SuggestionContextSchema = z.discriminatedUnion("success", [
    SuggestionContextSuccessSchema,
    SuggestionContextFailureSchema
]);

export type SuggestionContext = z.infer<typeof SuggestionContextSchema>;


export type SuggestionContextResponseModel = SuggestionContext;

export type SuggestionContextSuccess = z.infer<typeof SuggestionContextSuccessSchema>;

export const SuggestionErrorReasonSchema = z.enum([
    "redirect_because_context_missing",
    "redirect_because_server_returned_success_false",
    "redirect_because_context_validation_failed",
    "redirect_with_unknown_error",
]);

export type SuggestionErrorReason = z.infer<typeof SuggestionErrorReasonSchema>;

export const SuggestionHandoffSchema = z.discriminatedUnion("success", [
    z.object({
        handoffId: z.string().min(1),
        success: z.literal(true),
        context: SuggestionContextSuccessSchema,
    }),
    z.object({
        handoffId: z.string().min(1),
        success: z.literal(false),
        errorReason: SuggestionErrorReasonSchema
    }),
]);

export type ParsedSuggestionContext = z.infer<typeof SuggestionHandoffSchema>;