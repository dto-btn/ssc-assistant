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
});
