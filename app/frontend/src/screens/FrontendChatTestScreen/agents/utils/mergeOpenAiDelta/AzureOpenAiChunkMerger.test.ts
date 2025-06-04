import { describe, expect, it, beforeEach, vi, afterEach, Mock } from "vitest";
import { AzureOpenAiChunkMerger } from "./AzureOpenAiChunkMerger";
import type { ChatCompletionChunk } from "@azure/openai/types";
import simple_chat from "./testHelpers/simple_chat.json";

describe('AzureOpenAiChunkMerger', () => {
    let merger: AzureOpenAiChunkMerger;
    let simpleChatFirst6Chunks: ChatCompletionChunk[];
    
    beforeEach(() => {
        merger = new AzureOpenAiChunkMerger();

        // Take the first 6 chunks from the test data
        simpleChatFirst6Chunks = (simple_chat as Array<ChatCompletionChunk>).slice(0, 6);
    });

    describe('onEvent', () => {
        let mockListener: Mock;
        let unsubscribe: () => void;
        beforeEach(() => {
            mockListener = vi.fn();
            unsubscribe = merger.onEvent(mockListener);
        })
        afterEach(() => {
            unsubscribe();
            vi.clearAllMocks();
        })
        describe('listeners and registration', () => {
            it('should unsubscribe successfully', () => {
                // Arrange - Read the first chunk to trigger the listener
                merger.readChunk(simpleChatFirst6Chunks[0]);
                // Act - Unsubscribe the listener
                unsubscribe();
                // Act - Read another chunk
                merger.readChunk(simpleChatFirst6Chunks[1]);
                // Assert - Check if the listener was not called again
                expect(mockListener).toHaveBeenCalledTimes(1);
                expect(mockListener.mock.calls).toEqual([[{ type: "started" }]]);
            });
        });

        describe('event types', () => {
            describe('started', () => {
                it('should notify on processing', () => {
                    // Arrange - Read the first chunk to trigger the listener
                    expect(mockListener).toHaveBeenCalledTimes(0);
                    merger.readChunk(simpleChatFirst6Chunks[0]);
        
                    // Assert - Check if the listener was called with the correct event type
                    expect(mockListener.mock.calls).toEqual([[{ type: "started" }]]);
                });
            });

            describe('incomingText', () => {
                it('should notify on text accumulation', () => {
                    // Hello! I'm just a computer
                    // Arrange - Read the first chunk to trigger the listener
                    let accumulatedText = ""; // Initialize accumulated text
                    
                    let currChunk = 0; // function to get the next chunk
                    const getNextChunk = () => simpleChatFirst6Chunks[currChunk++];

                    const unsubscriber = merger.onEvent((event) => {
                        if (event.type === "incomingText") {
                            accumulatedText += event.data;
                        }
                    });

                    try {
                        expect(mockListener).toHaveBeenCalledTimes(0);
    
                        // Act - Read chunks and accumulate text
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("");
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("Hello, ");
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("Hello, I'm");
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("Hello, I'm just");
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("Hello, I'm just a");
                        merger.readChunk(getNextChunk());
                        expect(accumulatedText).toBe("Hello, I'm just a computer");
                    } finally {
                        unsubscriber(); // Unsubscribe after test
                    }
                });
            });
        })
    });
    
    describe('readChunk', () => {
        it('should correctly process and store incoming chunks', () => {
            // Act - Process each chunk
            for (const chunk of simpleChatFirst6Chunks) {
                merger.readChunk(chunk);
            }
            
            // Assert - Check internal state using public methods or test-specific getters if available
            expect(merger.getChunkHistoryLength()).toBe(simpleChatFirst6Chunks.length);
            for (let i = 0; i < simpleChatFirst6Chunks.length; i++) {
                expect(merger.getChunkAt(i)).toEqual(simpleChatFirst6Chunks[i]);
            }
        });
    });
    
    // Add more test groups for other methods as needed
    describe('edge cases', () => {
        it('should handle empty chunks properly', () => {
            // Arrange
            const emptyChunk: ChatCompletionChunk = {
                choices: [],
                created: 0,
                id: "",
                model: "",
                object: "chat.completion.chunk"
            };
            
            // Act - Should not throw an error
            expect(() => merger.readChunk(emptyChunk)).not.toThrow();
            
            // Assert - Verify state is maintained correctly
            expect(merger.getChunkHistoryLength()).toBe(1);
        });
        
        it('should handle null or undefined choices', () => {
            // Arrange
            const chunkWithNullChoices = {
                choices: null,
                created: 0,
                id: "",
                model: "",
                object: "chat.completion.chunk"
            } as unknown as ChatCompletionChunk;
            
            // Act - Should not throw an error
            expect(() => merger.readChunk(chunkWithNullChoices)).not.toThrow();
            
            // Assert - Verify state is maintained correctly
            expect(merger.getChunkHistoryLength()).toBe(1);
        });
    });
});