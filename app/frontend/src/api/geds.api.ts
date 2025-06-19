export interface GedsEmployee {
    id?: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    department?: string;
    organization?: string;
    email?: string;
    phone?: string;
    address?: string;
    url?: string;
}

export interface GedsSearchParams {
    employee_firstname: string;
    employee_lastname: string;
}

export interface GedsResponse {
    success: boolean;
    data?: GedsEmployee[];
    message: string;
    error?: string;
}

/**
 * Search GEDS (Government Employee Directory System) for employee information
 */
export const searchGedsEmployee = async (params: GedsSearchParams): Promise<GedsResponse> => {
    try {
        const response = await fetch('/api/2.0/geds/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("GEDS search error:", error);
        throw error;
    }
};
