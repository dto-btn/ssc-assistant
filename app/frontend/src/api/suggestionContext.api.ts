import { get } from "./api-utils";

type GetSuggestionContext = {
  suggestionContextId: string;
};

export const getSuggestionContext = async ({
  suggestionContextId,
}: GetSuggestionContext): Promise<unknown> => {
  const params = new URLSearchParams({ suggestionContextId });

  return get({
    url: `/api/1.0/suggest?${params.toString()}`,
  });
};
