import { useEffect, useMemo, useState } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";
import { AgentCoreMemory } from "../agents/AgentCoreMemory";
import { AgentToolRegistry } from "../agents/AgentToolRegistry";
import { searchBits, getBitsFields, getBitsStatuses, getBrInformation } from '../../../api/bits.api';
import { BitsQueryParams, BitsQueryFilter } from '../../BitsQueryScreen/types';

export const useAgentCore = () => {
    return useMemo(() => {
        const openai = provideProxyOpenAiClient();
        const memory = new AgentCoreMemory();
        const toolRegistry = new AgentToolRegistry();

        // Register an adder tool as an example
        toolRegistry.registerTool({
            name: 'adder',
            description: 'Adds a list of numbers together. Takes an array of numbers as input. For example, {"numbers": [1, 2, 3]} or {"numbers": [1, 2, 3, 4]}',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((sum, num) => sum + num, 0);
            }
        });

        // Register a subtractor tool as an example
        toolRegistry.registerTool({
            name: 'subtractor',
            description: 'Subtracts a list of numbers from the first number. Takes an array of numbers as input. For example, {"numbers": [10, 2, 3]} will return 5.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((result, num) => result - num);
            }
        });

        // Register a multiplier tool as an example
        toolRegistry.registerTool({
            name: 'multiplier',
            description: 'Multiplies a list of numbers together. Takes an array of numbers as input. For example, {"numbers": [2, 3, 4]} will return 24.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((product, num) => product * num, 1);
            }
        });

        // Register a divider tool as an example
        toolRegistry.registerTool({
            name: 'divider',
            description: 'Divides the first number by the second number. Takes an array of two numbers as input. For example, {"numbers": [10, 2]} will return 5.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers) || args.numbers.length !== 2) {
                    throw new Error("Invalid input: 'numbers' must be an array of two numbers.");
                }
                const [numerator, denominator] = args.numbers;
                if (denominator === 0) {
                    throw new Error("Division by zero is not allowed.");
                }
                return numerator / denominator;
            }
        });

        // Register BITS tools
        toolRegistry.registerTool({
            name: 'search_bits_data',
            description: 'Search the BITS (Business Information Technology Services) database for business requests. This tool allows you to find business requests using flexible filtering criteria. ' +
                        'USAGE: Use filters to search by specific field values, statuses to filter by request status, and limit to control result count. ' +
                        'FILTERS: Each filter has a "name" (field name like "BR_NUMBER", "BRANCH_NAME_EN", "STATUS_NAME_EN"), "value" (what to search for), and "operator" (=, <, >, <=, >=). ' +
                        'STATUSES: Array of status names like ["Open", "In Progress", "Closed", "Cancelled"]. ' +
                        'EXAMPLES: Search for open requests: {"statuses": ["Open"]}. Search by BR number: {"filters": [{"name": "BR_NUMBER", "value": "12345", "operator": "="}]}. ' +
                        'Search by branch: {"filters": [{"name": "BRANCH_NAME_EN", "value": "Ottawa", "operator": "="}]}. ' +
                        'LIMIT: Defaults to 50, maximum 1000. Use get_bits_fields first to see available field names.',
            func: async (args: { filters?: BitsQueryFilter[], statuses?: string[], limit?: number }) => {
                const filters: BitsQueryFilter[] = args.filters || [];
                const statuses: string[] = args.statuses || [];
                const limit: number = Math.min(args.limit || 50, 1000); // Cap at 1000

                const queryParams: BitsQueryParams = {
                    query_filters: filters,
                    statuses: statuses,
                    limit: limit
                };

                const result = await searchBits(queryParams);
                return {
                    success: true,
                    data: result,
                    message: `Found ${result.br.length} business requests (${result.metadata.total_rows} total in database)`
                };
            }
        });

        toolRegistry.registerTool({
            name: 'get_bits_fields',
            description: 'Get all available fields that can be used for searching and filtering BITS data. This tool returns field names, descriptions, and database field mappings. ' +
                        'USAGE: Call this tool with no parameters to retrieve the complete list of searchable fields. ' +
                        'PURPOSE: Use this tool BEFORE searching to understand what fields are available for filtering. Each field has a "name" (display name), "description" (what the field contains), and "db_field" (actual database column name). ' +
                        'COMMON FIELDS: Typically includes fields like BR_NUMBER (business request number), BRANCH_NAME_EN/FR (branch names), STATUS_NAME_EN/FR (status names), CREATED_DATE (when request was created), PRIORITY (request priority), etc. ' +
                        'BEST PRACTICE: Always call this first when users ask about searching BITS data, so you know what fields are available for filtering. ' +
                        'EXAMPLE USAGE: Call {"} (no parameters) to get all available fields, then use the field names in search_bits_data filters.',
            func: async () => {
                const result = await getBitsFields();
                return {
                    success: true,
                    data: result,
                    message: `Retrieved ${Object.keys(result).length} available BITS fields`
                };
            }
        });

        toolRegistry.registerTool({
            name: 'get_bits_statuses',
            description: 'Get all available statuses and phases in the BITS system. This includes status IDs, names in English and French, and associated phases. ' +
                        'USAGE: Call this tool with no parameters to retrieve the complete list of statuses and phases. ' +
                        'PURPOSE: Use this tool to understand what status values are available for filtering business requests. Each status includes STATUS_ID, NAME_EN (English name), NAME_FR (French name), PHASE_EN (English phase), and PHASE_FR (French phase). ' +
                        'WORKFLOW UNDERSTANDING: Statuses represent different stages in the business request lifecycle (e.g., "Open", "In Progress", "Closed", "Cancelled"). Phases group related statuses together (e.g., "Planning", "Implementation", "Closure"). ' +
                        'FILTERING USAGE: Use the NAME_EN or NAME_FR values from this tool\'s response when creating status filters for search_bits_data. ' +
                        'EXAMPLE USAGE: Call this tool first to see available statuses, then use status names like ["Open", "In Progress"] in search_bits_data to filter by those statuses. ' +
                        'LOCALIZATION: Both English and French names are provided to support bilingual filtering and display.',
            func: async () => {
                const result = await getBitsStatuses();
                return {
                    success: true,
                    data: result,
                    message: `Retrieved ${result.statuses.length} available BITS statuses`
                };
            }
        });

        toolRegistry.registerTool({
            name: 'get_br_information',
            description: 'Get detailed information about specific Business Request (BR) numbers. Provide an array of BR numbers to retrieve their full details. ' +
                        'USAGE: Call this tool with {"brNumbers": [array_of_br_numbers]} where array_of_br_numbers contains one or more BR numbers as integers. ' +
                        'PURPOSE: Use this tool when you need complete details about specific business requests that you already know the BR numbers for. This is more efficient than searching when you have exact BR numbers. ' +
                        'INPUT FORMAT: The brNumbers parameter must be an array of integers (not strings). For example: {"brNumbers": [55343]} for a single BR, or {"brNumbers": [55343, 55344, 55345]} for multiple BRs. ' +
                        'RESPONSE: Returns complete business request records including all fields like status, branch, description, dates, priority, assigned users, etc. ' +
                        'WORKFLOW: This tool is typically used after search_bits_data when you want full details about specific BRs found in search results, or when users mention specific BR numbers directly. ' +
                        'ERROR HANDLING: Tool will fail if brNumbers is empty, not an array, contains non-numeric values, or if the BR numbers don\'t exist in the database. ' +
                        'EXAMPLE USAGE: {"brNumbers": [55343]} to get details for BR 55343, or {"brNumbers": [55343, 55344]} to get details for multiple BRs.',
            func: async (args: { brNumbers: number[] }) => {
                if (!Array.isArray(args.brNumbers) || args.brNumbers.length === 0) {
                    throw new Error("Invalid input: 'brNumbers' must be a non-empty array of numbers.");
                }

                const result = await getBrInformation(args.brNumbers);
                return {
                    success: true,
                    data: result,
                    message: `Retrieved information for ${result.br.length} business requests`
                };
            }
        });

        const agentCore = new AgentCore(
            openai,
            memory,
            toolRegistry
        );

        return {
            agentCore,
            openai,
            memory
        }
    }, []);
}

// subscribe to memory.exports
export const useMemoryExports = (memory: AgentCoreMemory) => {
    const [turns, setTurns] = useState(memory.export());

    useEffect(() => {
        const unsubscriber = memory.onUpdate((event) => {
            console.log("Update event received:", event);
            setTurns(memory.export());
        });

        return () => {
            unsubscriber();
        }
    }, [memory]); 
    
    return turns;
}