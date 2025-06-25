import { useEffect, useMemo, useState } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";
import { AgentCoreMemory } from "../agents/AgentCoreMemory";
import { AgentToolRegistry } from "../agents/AgentToolRegistry";
import { searchBits, getBitsFields, getBitsStatuses, getBrInformation } from '../../../api/bits.api';
import { BitsQueryParams, BitsQueryFilter } from '../../BitsQueryScreen/types';
import { searchGedsEmployee, GedsSearchParams } from '../../../api/geds.api';

export const useAgentCore = () => {
    return useMemo(() => {
        const openai = provideProxyOpenAiClient();
        const memory = new AgentCoreMemory();
        const toolRegistry = new AgentToolRegistry();
        
        // toolRegistry.registerMcp({
        //     name: 'ssc',
        //     version: '1.0',
        //     type: 'streamable-http',
        //     url: 'https://br-mcp-server-app.azurewebsites.net/mcp/',
        // });

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
                        'USAGE: Use filters to search by specific field values, statuses to filter by request status, select_fields to choose which fields to return, and limit to control result count. ' +
                        'FILTERS: Each filter has a "name" (field name like "BR_NUMBER", "BRANCH_NAME_EN", "STATUS_NAME_EN"), "value" (what to search for), and "operator" (=, <, >, <=, >=). ' +
                        'STATUSES: Array of status names like ["Open", "In Progress", "Closed", "Cancelled"]. ' +
                        'SELECT_FIELDS: Array of field names to return. If not provided, throws an error. Use get_bits_fields to see available field names. This is a required field. Empty array is a bad value. It must be populated with at least 1 field.' +
                        'EXAMPLES: Search for open requests: {"statuses": ["Open"]}. Search by BR number: {"filters": [{"name": "BR_NUMBER", "value": "12345", "operator": "="}]}. ' +
                        'Search by branch: {"filters": [{"name": "BRANCH_NAME_EN", "value": "Ottawa", "operator": "="}]}. ' +
                        'Specify fields: {"filters": [...], "select_fields": ["BR_NUMBER", "STATUS_NAME_EN", "BRANCH_NAME_EN"]}. ' +
                        'LIMIT: Defaults to 50, maximum 1000. Use get_bits_fields first to see available field names.',
            func: async (args: { filters?: BitsQueryFilter[], statuses?: string[], select_fields?: string[], limit?: number }) => {
                const filters: BitsQueryFilter[] = args.filters || [];
                const statuses: string[] = args.statuses || [];
                const select_fields: string[] = args.select_fields || []; // Empty array means all fields
                const limit: number = Math.min(args.limit || 50, 1000); // Cap at 1000

                const queryParams: BitsQueryParams = {
                    query_filters: filters,
                    statuses: statuses,
                    select_fields: select_fields,
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

        // Register GEDS tools
        toolRegistry.registerTool({
            name: 'search_geds_employee',
            description: 'Search the GEDS (Government Employee Directory System) for Government of Canada employee information by name. This is for a SINGLE employee.' +
                        'USAGE: Provide both first name and last name to find employee contact information, department, title, and organizational details. ' +
                        'PURPOSE: Use this tool to find contact information for specific government employees when you have their name. ' +
                        'REQUIRED FIELDS: Both employee_firstname and employee_lastname are required for accurate search results. ' +
                        'RESPONSE: Returns employee details including name, title, department, organization, email, phone, address, and GEDS profile URL. ' +
                        'EXAMPLES: {"employee_firstname": "John", "employee_lastname": "Smith"} to find John Smith. But to find Jane Doe, {"employee_firstname": "Jane", "employee_lastname": "Doe"}' +
                        'PRIVACY: Only use this tool when explicitly asked to find contact information for a specific person. Do not use for general directory browsing. ' +
                        'NOTE: This searches the official Government of Canada employee directory and returns publicly available contact information.' +
                        'MULTIPLE EMPLOYEES: If you need to search for multiple employees, call this tool separately for each employee. Do not concatenate names in a single call.',
            func: async (args: { employee_firstname: string, employee_lastname: string }) => {
                if (!args.employee_firstname || !args.employee_lastname) {
                    throw new Error("Invalid input: both 'employee_firstname' and 'employee_lastname' are required.");
                }

                const searchParams: GedsSearchParams = {
                    employee_firstname: args.employee_firstname.trim(),
                    employee_lastname: args.employee_lastname.trim()
                };

                const result = await searchGedsEmployee(searchParams);
                return {
                    success: result.success,
                    data: result.data || [],
                    message: result.message || `Search completed for ${args.employee_firstname} ${args.employee_lastname}`
                };
            }
        });

        // Register Wikipedia/Wikimedia tools
        toolRegistry.registerTool({
            name: 'search_wikipedia',
            description: 'Search Wikipedia articles by title or content. Returns a list of matching articles with titles, descriptions, and URLs. ' +
                        'USAGE: Provide a search query string to find relevant Wikipedia articles. ' +
                        'PURPOSE: Use this tool to find Wikipedia articles related to topics the user is asking about. Good for finding background information, definitions, or context. ' +
                        'INPUT: {"query": "search terms"} where search terms can be keywords, phrases, or topics. ' +
                        'RESPONSE: Returns array of search results with title, description/snippet, and page URL. ' +
                        'EXAMPLES: {"query": "artificial intelligence"}, {"query": "Government of Canada"}, {"query": "machine learning algorithms"}. ' +
                        'FOLLOW-UP: Use wikipedia_get_content or wikipedia_get_summary to get detailed information about specific articles found.',
            func: async (args: { query: string, limit?: number }) => {
                if (!args.query || typeof args.query !== 'string') {
                    throw new Error("Invalid input: 'query' must be a non-empty string.");
                }

                const limit = Math.min(args.limit || 10, 50); // Cap at 50 results
                const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.query)}`;
                
                try {
                    // First try direct page lookup
                    const directResponse = await fetch(searchUrl, {
                        headers: {
                            'User-Agent': 'SSC-Assistant/1.0 (Government of Canada BITS System)',
                            'Accept': 'application/json'
                        }
                    });

                    if (directResponse.ok) {
                        const directResult = await directResponse.json();
                        return {
                            success: true,
                            data: [directResult],
                            message: `Found direct match for "${args.query}"`
                        };
                    }

                    // Fall back to search API
                    const opensearchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.query)}`;
                    const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(args.query)}&limit=${limit}&namespace=0&format=json&origin=*`;
                    
                    const response = await fetch(searchApiUrl, {
                        headers: {
                            'User-Agent': 'SSC-Assistant/1.0 (Government of Canada BITS System)',
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Wikipedia API error: ${response.status}`);
                    }

                    const [query, titles, descriptions, urls] = await response.json();
                    const results = titles.map((title: string, index: number) => ({
                        title,
                        description: descriptions[index] || '',
                        url: urls[index] || ''
                    }));

                    return {
                        success: true,
                        data: results,
                        message: `Found ${results.length} Wikipedia articles for "${args.query}"`
                    };
                } catch (error) {
                    throw new Error(`Failed to search Wikipedia: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });

        toolRegistry.registerTool({
            name: 'wikipedia_get_summary',
            description: 'Get a summary of a specific Wikipedia article by title. Returns the article introduction, key facts, and basic information. ' +
                        'USAGE: Provide the exact title of a Wikipedia article to get its summary. ' +
                        'PURPOSE: Use this tool to get concise information about a specific topic without retrieving the full article content. ' +
                        'INPUT: {"title": "exact_article_title"} where exact_article_title is the Wikipedia page title (usually from search results). ' +
                        'RESPONSE: Returns article summary with title, extract (first few paragraphs), page URL, and basic metadata. ' +
                        'EXAMPLES: {"title": "Artificial intelligence"}, {"title": "Government of Canada"}, {"title": "Machine learning"}. ' +
                        'NOTE: Use the exact title from search_wikipedia results for best accuracy.',
            func: async (args: { title: string }) => {
                if (!args.title || typeof args.title !== 'string') {
                    throw new Error("Invalid input: 'title' must be a non-empty string.");
                }

                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.title)}`;
                
                try {
                    const response = await fetch(summaryUrl, {
                        headers: {
                            'User-Agent': 'SSC-Assistant/1.0 (Government of Canada BITS System)',
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        if (response.status === 404) {
                            throw new Error(`Wikipedia article "${args.title}" not found`);
                        }
                        throw new Error(`Wikipedia API error: ${response.status}`);
                    }

                    const result = await response.json();
                    return {
                        success: true,
                        data: result,
                        message: `Retrieved summary for Wikipedia article "${args.title}"`
                    };
                } catch (error) {
                    throw new Error(`Failed to get Wikipedia summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });

        toolRegistry.registerTool({
            name: 'wikipedia_get_content',
            description: 'Get the full content of a specific Wikipedia article by title. Returns the complete article text in various formats. ' +
                        'USAGE: Provide the exact title of a Wikipedia article to get its full content. ' +
                        'PURPOSE: Use this tool when you need detailed information from a Wikipedia article beyond just the summary. ' +
                        'INPUT: {"title": "exact_article_title", "format": "html|wikitext|plain"} where format defaults to "html". ' +
                        'RESPONSE: Returns full article content, title, revision info, and metadata. ' +
                        'FORMATS: "html" for formatted content, "wikitext" for raw wiki markup, "plain" for plain text. ' +
                        'EXAMPLES: {"title": "Artificial intelligence", "format": "html"}, {"title": "Government of Canada"}. ' +
                        'WARNING: Full articles can be very long. Use wikipedia_get_summary for shorter content.',
            func: async (args: { title: string, format?: string }) => {
                if (!args.title || typeof args.title !== 'string') {
                    throw new Error("Invalid input: 'title' must be a non-empty string.");
                }

                const format = args.format || 'html';
                const validFormats = ['html', 'wikitext', 'plain'];
                if (!validFormats.includes(format)) {
                    throw new Error(`Invalid format: must be one of ${validFormats.join(', ')}`);
                }

                const contentUrl = `https://en.wikipedia.org/api/rest_v1/page/${format}/${encodeURIComponent(args.title)}`;
                
                try {
                    const response = await fetch(contentUrl, {
                        headers: {
                            'User-Agent': 'SSC-Assistant/1.0 (Government of Canada BITS System)',
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        if (response.status === 404) {
                            throw new Error(`Wikipedia article "${args.title}" not found`);
                        }
                        throw new Error(`Wikipedia API error: ${response.status}`);
                    }

                    const result = await response.json();
                    return {
                        success: true,
                        data: result,
                        message: `Retrieved full content for Wikipedia article "${args.title}" in ${format} format`
                    };
                } catch (error) {
                    throw new Error(`Failed to get Wikipedia content: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
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