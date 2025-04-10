type GetProps = {
    url: string;
    accessToken?: string;
}
export const get = async (props: GetProps) => {
    return doFetch({ verb: "GET", ...props });
}

type PostProps = {
    url: string;
    accessToken: string;
    body: object;
}
export const post = async (props: PostProps) => {
    return doFetch({ verb: "POST", ...props });
}

type DoFetchProps = {
    verb: "GET" | "POST" | "PUT" | "DELETE";
    url: string;
    accessToken?: string;
    body?: object;
}
const doFetch = async (props: DoFetchProps) => {
    const { verb, url, accessToken } = props;

    const headersInit: HeadersInit = {
        "Content-Type": "application/json"
    }

    const requestInit: RequestInit = {
        method: verb,
        headers: headersInit
    }

    if (accessToken) {
        headersInit["Authorization"] = "Bearer " + accessToken.trim();
    }

    if (props.body) {
        requestInit.body = JSON.stringify(props.body);
    }

    try {
        const response = await fetch(url, requestInit);

        if (!response.ok) {
            // This handles non-2xx errors.
            throw new Error(`Failed to get data, status: ${response.status}. Check the network tab for more info.`);
        }

        return await response.json();
    } catch (e: any) {
        const errorText = e?.message || "Unknown error while fetching data";
        const errMsg = `[${verb} ${url}] ${errorText}`;
        console.error(errMsg, e);
        throw e;
    }
}