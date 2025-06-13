import { BitsQueryParams, BitsStatus, BitsFieldMap } from "../screens/BitsQueryScreen/types";

interface BitsResponse {
    br: BusinessRequest[];
    metadata: {
        execution_time: number;
        results: number;
        total_rows: number;
        extraction_date: string;
    };
    error?: string;
}

/**
 * Search BITS database using the given parameters
 */
export const searchBits = async (params: BitsQueryParams): Promise<BitsResponse> => {
    try {
        const response = await fetch('/api/1.0/bits/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                br_query: JSON.stringify(params)
            }),
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("BITS search error:", error);
        throw error;
    }
};

/**
 * Get all available BITS fields that can be used for searching
 */
export const getBitsFields = async (): Promise<BitsFieldMap> => {
    try {
        const response = await fetch('/api/1.0/bits/fields');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching BITS fields:", error);
        throw error;
    }
};

/**
 * Get all available BITS statuses
 */
export const getBitsStatuses = async (): Promise<{ statuses: BitsStatus[] }> => {
    try {
        const response = await fetch('/api/1.0/bits/statuses');

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching BITS statuses:", error);
        throw error;
    }
};

/**
 * Get information about specific BR numbers
 */
export const getBrInformation = async (brNumbers: number[]): Promise<BitsResponse> => {
    try {
        const response = await fetch('/api/1.0/bits/br', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                br_numbers: brNumbers
            }),
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching BR information:", error);
        throw error;
    }
};
