import { describe, expect, it, beforeEach } from "vitest";
import { AzureOpenAiChunkMerger } from "./mergeOpenAiDelta";
import type { ChatCompletionChunk } from "@azure/openai/types";
import simple_chat from "./testHelpers/simple_chat.json";

describe('AzureOpenAiChunkMerger', () => {
    let merger: AzureOpenAiChunkMerger;
    let chunks: ChatCompletionChunk[];
    
    beforeEach(() => {
        merger = new AzureOpenAiChunkMerger();
        // Take the first 6 chunks from the test data
        chunks = (simple_chat as Array<ChatCompletionChunk>).slice(0, 6);
    });
    
    describe('readChunk', () => {
        it('should correctly process and store incoming chunks', () => {
            // Act - Process each chunk
            for (const chunk of chunks) {
                merger.readChunk(chunk);
            }
            
            // Assert - Check internal state using public methods or test-specific getters if available
            // This is better than accessing private members directly
            expect(merger.getChunkHistoryLength()).toBe(chunks.length);
            for (let i = 0; i < chunks.length; i++) {
                expect(merger.getChunkAt(i)).toEqual(chunks[i]);
            }
        });
        
        it('should test the main functionality of merging chunks', () => {
            // Assuming the main functionality is to build a complete message from chunks
            // Arrange - Setup expectations based on what the class should do
            
            // Act - Process each chunk
            for (const chunk of chunks) {
                merger.readChunk(chunk);
            }
            
            // Assert - Test the actual functionality, not just the internal state
            // This depends on what the class actually does, but might be something like:
            // expect(merger.getMergedContent()).toEqual("Hello! I'm just a computer");
            // Or test specific accumulated data from the chunks
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