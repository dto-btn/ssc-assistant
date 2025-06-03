import { describe, expect, it } from "vitest";
import { mergeOpenAiDelta } from "./AgentCoreLlmClientStreaming.utils";
import OpenAI from "openai";

describe('AgentCoreLlmClientStreaming utils', () => {
    describe('mergeOpenAiDelta', () => {
        it('should merge nested objects correctly', () => {
            const target = { a: { b: 1, c: 2 }, d: 3 };
            const source = { a: { b: 4, e: 5 }, d: 6, f: 7 };
            const expected = { a: { b: 4, c: 2, e: 5 }, d: 6, f: 7 };   
            mergeOpenAiDelta(target, source);
            expect(target).toEqual(expected);
        });

        it('should merge objects with deeply nested arrays of objects, which also have nested arrays of objects', () => {
            const target = {
                a: {
                    b: [{ x: 1, y: 2 }, { z: 3 }],
                    c: 2
                },
                d: 3
            };
            const source = {
                a: {
                    b: [{ x: 4 }, { w: 5 }],
                    e: 5
                },
                d: 6,
                f: 7
            };
            const expected = {
                a: {
                    b: [{ x: 4, y: 2 }, { z: 3, w: 5 }],
                    c: 2,
                    e: 5
                },
                d: 6,
                f: 7
            };
            mergeOpenAiDelta(target, source);
            expect(target).toEqual(expected);
        })

        describe('openai', () => {
            it('should merge OpenAI chat completion message deltas correctly', () => {
                const target: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: '',
                    tool_calls: []
                };

                const source: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: 'Hello, ',
                    tool_calls: [{ id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: "{}" } }]
                };

                const expected: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: 'Hello, ',
                    tool_calls: [{ id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: "{}" } }]
                };

                mergeOpenAiDelta(target, source);
                expect(target).toEqual(expected);
            });

            it('should handle merging tool calls with deltas', () => {
                const target: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: '',
                    tool_calls: [
                        { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: "{}" } }
                    ]
                };
                const source: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: 'Executing tool calls.',
                    tool_calls: [
                        { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: '{"param": "value"}' } },
                        { id: 'tool2', type: 'function', function: { name: 'anotherFunction', arguments: '{"param2": "value2"}' } }
                    ]
                };

                const expected: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: 'Executing tool calls.',
                    tool_calls: [
                        { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: '{"param": "value"}' } },
                        { id: 'tool2', type: 'function', function: { name: 'anotherFunction', arguments: '{"param2": "value2"}' } }
                    ]
                };
                mergeOpenAiDelta(target, source);
                expect(target).toEqual(expected);
            });

            it('should handle merging tool calls where the parameters come in as multiple deltas', () => {
                const target: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {

                };

                const sources: Partial<OpenAI.Chat.Completions.ChatCompletionMessage>[] = [
                    {
                        role: 'assistant',
                        content: 'Executing tool calls.',
                        tool_calls: [
                            { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: '{"param":' } }
                        ]
                    },
                    {
                        role: 'assistant',
                        content: '',
                        tool_calls: [
                            { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: '"value"}' } }
                        ]
                    },
                    {
                        role: 'assistant',
                        content: '',
                        tool_calls: [
                            { id: 'tool2', type: 'function', function: { name: 'anotherFunction', arguments: '{"param2": "value2"}' } }
                        ]
                    }
                ];

                const expected: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                    role: 'assistant',
                    content: 'Executing tool calls.',
                    tool_calls: [
                        { id: 'tool1', type: 'function', function: { name: 'testFunction', arguments: '{"param":"value"}' } },
                        { id: 'tool2', type: 'function', function: { name: 'anotherFunction', arguments: '{"param2": "value2"}' } }
                    ]
                };
                sources.forEach(source => mergeOpenAiDelta(target, source));
                expect(target).toEqual(expected);
            });


                
        })
    });

});