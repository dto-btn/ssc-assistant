export type SuggestionContextResponseModel = {
    success: boolean;
    language: "en" | "fr";
    original_query: string;
    timestamp: string;
    requester: string;
    content: string;
    citations: {
        title: string;
        url: string;
    }[];
}