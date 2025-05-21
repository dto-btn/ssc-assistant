import { useEffect, useState } from 'react';
import { useBitsAgent } from './useBitsAgent';
import { BitsQueryParams } from '../types';

/**
 * Hook to connect the BITS Query Form with the BITS Agent.
 * This allows the agent to control the form state and execute queries.
 */
export const useBitsFormConnection = (
    formSubmit: (params: BitsQueryParams) => Promise<void>
) => {
    const {
        filters,
        statuses,
        submitQueryResult,
        onSubmitQueryComplete
    } = useBitsAgent();

    const [isConnected, setIsConnected] = useState(false);

    // Effect to submit the query when the agent calls the submitQuery tool
    useEffect(() => {
        if (submitQueryResult) {
            // Build query params from the current agent state
            const queryParams: BitsQueryParams = {
                query_filters: filters,
                statuses: statuses,
                limit: 100, // Default value, could be made configurable
            };

            // Execute the query
            formSubmit(queryParams)
                .then(() => {
                    // Notify the agent that the query completed successfully
                    onSubmitQueryComplete(true, null);
                })
                .catch((error) => {
                    // Notify the agent that the query failed
                    onSubmitQueryComplete(false, error.message || 'Query execution failed');
                });
        }
    }, [submitQueryResult, filters, statuses, formSubmit, onSubmitQueryComplete]);

    // Connect or disconnect the form from the agent
    const toggleConnection = (connect: boolean) => {
        setIsConnected(connect);
    };

    return {
        isConnected,
        toggleConnection,
    };
};
