import { mergeToolCallsFromJson } from './mergeStreamingToolCalls';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility to demonstrate the usage of the mergeToolCallsFromJson function
 * 
 * This script reads the streaming_tool_calls.json file, processes it,
 * and outputs the merged result.
 */
async function demonstrateMergeToolCalls() {
    try {
        // Read the streaming_tool_calls.json file
        const filePath = path.resolve(__dirname, 'testcaseData', 'streaming_tool_calls.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        // Parse the JSON data
        const jsonData = JSON.parse(fileContent);
        
        // Merge the streaming tool calls
        const mergedMessage = mergeToolCallsFromJson(jsonData);
        
        // Log the result
        console.log('Merged message:');
        console.log(JSON.stringify(mergedMessage, null, 2));
        
        // Optional: Save the merged result to a file
        const outputPath = path.resolve(__dirname, 'testcaseData', 'merged_tool_calls.json');
        fs.writeFileSync(outputPath, JSON.stringify(mergedMessage, null, 2));
        console.log(`Merged result saved to: ${outputPath}`);
        
        return mergedMessage;
    } catch (error) {
        console.error('Error in demonstrateMergeToolCalls:', error);
        throw error;
    }
}

// Execute the demonstration if this script is run directly
if (require.main === module) {
    demonstrateMergeToolCalls()
        .then(() => console.log('Demonstration completed successfully'))
        .catch(error => console.error('Demonstration failed:', error));
}

export { demonstrateMergeToolCalls };
