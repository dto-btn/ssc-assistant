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
        it('should register and notify listeners on chunk processing', () => {
            // Arrange - Read the first chunk to trigger the listener
            merger.readChunk(simpleChatFirst6Chunks[0]);

            // Assert - Check if the listener was called with the correct event type
            expect(mockListener.mock.calls).toEqual([[{ type: "started" }]]);
        });
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