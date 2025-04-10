import { get } from "./api-utils"
import { SuggestionContextResponseModel } from "./suggestionContext.models";

type GetSuggestionContext = {
    suggestionContextId: string;
}
export const getSuggestionContext = async (props: GetSuggestionContext): Promise<SuggestionContextResponseModel> => {
    const report = await get({
        url: "/api/1.0/suggest?suggestionContextId=" + props.suggestionContextId
    });

    return report;
}
