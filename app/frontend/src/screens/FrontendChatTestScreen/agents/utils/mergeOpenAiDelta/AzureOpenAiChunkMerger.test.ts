import { describe, expect, it, beforeEach, vi, afterEach, Mock } from "vitest";
import { AzureOpenAiChunkMerger } from "./AzureOpenAiChunkMerger";
import type { ChatCompletionChunk } from "@azure/openai/types";
import {simpleChat} from "./testHelpers/simple_chat"

describe('AzureOpenAiChunkMerger', () => {
    let merger: AzureOpenAiChunkMerger;
    
    beforeEach(() => {
        merger = new AzureOpenAiChunkMerger();
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
                merger.readChunk(simpleChat[0]);
                // Act - Unsubscribe the listener
                unsubscribe();
                // Act - Read another chunk
                merger.readChunk(simpleChat[1]);
                // Assert - Check if the listener was not called again
                expect(mockListener).toHaveBeenCalledTimes(1);
                expect(mockListener.mock.calls).toEqual([[{ type: "all-started" }]]);
            });
        });

        describe('event types', () => {
            describe('all-started', () => {
                it('should notify on processing', () => {
                    // Arrange - Read the first chunk to trigger the listener
                    expect(mockListener).toHaveBeenCalledTimes(0);
                    merger.readChunk(simpleChat[0]);
        
                    // Assert - Check if the listener was called with the correct event type
                    expect(mockListener.mock.calls).toEqual([[{ type: "all-started" }]]);
                });
            });

            describe('streaming-text-accumulated', () => {
                it('should notify on text accumulation', () => {
                    // Hello! I'm just a computer
                    // Arrange - Read the first chunk to trigger the listener
                    let latestData = ""; // Initialize accumulated text
                    
                    let currChunk = 0; // function to get the next chunk
                    const getNextChunk = () => simpleChat[currChunk++];

                    const unsubscriber = merger.onEvent((event) => {
                        if (event.type !== "streaming-text-accumulated") {
                            return;
                        }
                        
                        latestData = event.data;
                    });

                    try {
                        expect(mockListener).toHaveBeenCalledTimes(0);
    
                        // Act - Read chunks and accumulate text
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello!");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello! I'm");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello! I'm just");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello! I'm just a");
                        merger.readChunk(getNextChunk());
                        expect(latestData).toBe("Hello! I'm just a computer");
                    } finally {
                        unsubscriber(); // Unsubscribe after test
                    }
                });
            });
        })
    });
    
    describe('readChunk', () => {
        it('should correctly process and store incoming chunks', () => {
            expect(merger.getChunkHistory().length).toBe(0);
            expect(merger.getDeltas()).toEqual([]); 
            expect(merger.getChunkHistory()).toEqual([]);
            // Act - Process each chunk
            for (const chunk of simpleChat) {
                merger.readChunk(chunk);
            }
            
            // Assert - Check internal state using public methods or test-specific getters if available
            expect(merger.getChunkHistory().length).toBe(simpleChat.length);
            expect(merger.getChunkHistory()).toEqual(simpleChat);
            const choices = merger.getDeltas();
            expect(choices).toEqual([{
                content: "Hello! I'm just a computer program, so I don't have feelings, but I'm here and ready to help you. How can I assist you today?",
                refusal: null,
                role: 'assistant'
            }]);
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
            expect(merger.getChunkHistory().length).toBe(1);
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
            expect(merger.getChunkHistory().length).toBe(1);
        });
    });
});