import { describe, expect, it } from 'vitest';
import { mergeStreamingToolCalls } from './mergeStreamingToolCalls';

describe('mergeStreamingToolCalls', () => {
    it('should merge content from multiple chunks', () => {
        const chunks = [
            {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: 'Hello'
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            content: ' world'
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            content: '!'
                        }
                    }
                ]
            }
        ];

        const result = mergeStreamingToolCalls(chunks);
        expect(result.role).toBe('assistant');
        expect(result.content).toBe('Hello world!');
        expect(result.tool_calls).toBeUndefined();
    });

    it('should merge tool calls from multiple chunks', () => {
        const chunks = [
            {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    type: 'function',
                                    function: {
                                        name: 'get_'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    function: {
                                        name: 'weather',
                                        arguments: '{"location":'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    function: {
                                        arguments: ' "New York"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        const result = mergeStreamingToolCalls(chunks);
        expect(result.role).toBe('assistant');
        expect(result.content).toBeNull();
        expect(result.tool_calls).toHaveLength(1);
        expect(result.tool_calls![0].id).toBe('call_1');
        expect(result.tool_calls![0].type).toBe('function');
        expect(result.tool_calls![0].function.name).toBe('get_weather');
        expect(result.tool_calls![0].function.arguments).toBe('{"location": "New York"}');
    });

    it('should handle multiple tool calls in the same message', () => {
        const chunks = [
            {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [
                                {
                                    index: 0,
                                    id: 'call_1',
                                    type: 'function',
                                    function: {
                                        name: 'get_weather',
                                        arguments: '{"location": "New York"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 1,
                                    id: 'call_2',
                                    type: 'function',
                                    function: {
                                        name: 'get_time',
                                        arguments: '{"timezone": "EST"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        const result = mergeStreamingToolCalls(chunks);
        expect(result.role).toBe('assistant');
        expect(result.content).toBeNull();
        expect(result.tool_calls).toHaveLength(2);
        
        // First tool call
        expect(result.tool_calls![0].id).toBe('call_1');
        expect(result.tool_calls![0].function.name).toBe('get_weather');
        expect(result.tool_calls![0].function.arguments).toBe('{"location": "New York"}');
        
        // Second tool call
        expect(result.tool_calls![1].id).toBe('call_2');
        expect(result.tool_calls![1].function.name).toBe('get_time');
        expect(result.tool_calls![1].function.arguments).toBe('{"timezone": "EST"}');
    });

    it('should handle empty or malformed chunks', () => {
        const chunks = [
            { choices: [] },
            { created: 1234, id: 'abc', model: 'gpt-4', object: 'chat.completion.chunk' },
            {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            content: 'Hello'
                        }
                    }
                ]
            }
        ];

        const result = mergeStreamingToolCalls(chunks);
        expect(result.role).toBe('assistant');
        expect(result.content).toBe('Hello');
    });

    it('should handle multiple tool calls with different indexes correctly (not concatenate)', () => {
        // This test specifically addresses the issue where multiple tool calls
        // with different indexes were being concatenated instead of treated separately
        const chunks = [
            {
                choices: [
                    {
                        delta: {
                            role: 'assistant',
                            tool_calls: [
                                {
                                    index: 0,
                                    type: 'function',
                                    function: {
                                        name: 'search_geds_employee',
                                        arguments: '{"employee_firstname": "John",'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 0,
                                    function: {
                                        arguments: ' "employee_lastname": "Smith"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 1,
                                    type: 'function',
                                    function: {
                                        name: 'search_geds_employee',
                                        arguments: '{"employee_firstname": "Jane",'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 1,
                                    function: {
                                        arguments: ' "employee_lastname": "Doe"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                {
                                    index: 2,
                                    function: {
                                        name: 'search_geds_employee',
                                        arguments: '{"employee_firstname": "Alice", '
                                    }
                                },
                                {
                                    index: 2,
                                    function: {
                                        arguments: '"employee_lastname": "Johnson"}'
                                    }
                                },
                                {
                                    index: 3,
                                    type: 'function',
                                    function: {
                                        name: 'search_geds_employee',
                                        arguments: '{"employee_firstname": "Bob", '
                                    }
                                },
                                {
                                    index: 3,
                                    function: {
                                        arguments: '"employee_lastname": "Brown"}'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        const result = mergeStreamingToolCalls(chunks);
        
        expect(result.role).toBe('assistant');
        expect(result.content).toBeNull();
        expect(result.tool_calls).toHaveLength(4);
        
        // First tool call (index 0)
        expect(result.tool_calls![0].function.name).toBe('search_geds_employee');
        expect(result.tool_calls![0].function.arguments).toBe('{"employee_firstname": "John", "employee_lastname": "Smith"}');
        
        // Second tool call (index 1) - should be separate, not concatenated
        expect(result.tool_calls![1].function.name).toBe('search_geds_employee');
        expect(result.tool_calls![1].function.arguments).toBe('{"employee_firstname": "Jane", "employee_lastname": "Doe"}');

        // Third tool call (index 2)
        expect(result.tool_calls![2].function.name).toBe('search_geds_employee');
        expect(result.tool_calls![2].function.arguments).toBe('{"employee_firstname": "Alice", "employee_lastname": "Johnson"}');

        // Fourth tool call (index 3)
        expect(result.tool_calls![3].function.name).toBe('search_geds_employee');
        expect(result.tool_calls![3].function.arguments).toBe('{"employee_firstname": "Bob", "employee_lastname": "Brown"}');
        
        // Verify they are NOT concatenated
        expect(result.tool_calls![0].function.arguments).not.toContain('Jane');
        expect(result.tool_calls![1].function.arguments).not.toContain('John');
    });
});
