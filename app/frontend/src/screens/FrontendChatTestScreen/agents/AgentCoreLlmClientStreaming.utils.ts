/**
 * This merge function is used to recursively merge properties from an OpenAI streaming source object into a target 
 * object. It handles nested objects and arrays, ensuring that properties are merged correctly.
 * 
 * It is mainly used to accumulate deltas from streaming responses, allowing for incremental updates
 * to the target object without losing existing properties.
 * 
 * The function modifies the target object in place, so it does not return a new object.
 * 
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns void
 */
export const mergeDelta = (target: any, source: any): void => {
    if (typeof source !== 'object' || source === null) {
        return; // Base case, nothing to merge
    }
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = source[key];
            
            // Skip undefined values
            if (sourceValue === undefined) {
                continue;
            }
            
            // Handle arrays specially
            if (Array.isArray(sourceValue)) {
                if (!Array.isArray(target[key])) {
                    // Initialize as empty array if it doesn't exist or isn't an array
                    target[key] = [];
                }
                
                // For arrays, we need to ensure all indexes exist and merge objects at each index
                sourceValue.forEach((item, index) => {
                    // For new indexes, initialize with empty object or the new value
                    if (index >= target[key].length) {
                        if (typeof item === 'object' && item !== null) {
                            target[key][index] = Array.isArray(item) ? [] : {};
                            mergeDelta(target[key][index], item);
                        } else {
                            target[key][index] = item;
                        }
                    } 
                    // For existing indexes with objects, merge recursively
                    else if (typeof item === 'object' && item !== null && typeof target[key][index] === 'object') {
                        mergeDelta(target[key][index], item);
                    }
                    // For existing indexes with non-objects, replace
                    else if (item !== undefined) {
                        target[key][index] = item;
                    }
                });
            } 
            // Handle objects
            else if (typeof sourceValue === 'object' && sourceValue !== null) {
                // If target[key] doesn't exist or isn't an object, initialize it
                if (typeof target[key] !== 'object' || target[key] === null) {
                    target[key] = {};
                }
                mergeDelta(target[key], sourceValue); // Recurse
            } 
            else {
                // Special handling for certain fields that should not be concatenated
                const nonConcatenatedFields = ['role', 'id', 'type'];
                
                // For content field or other strings that should be concatenated
                if (typeof sourceValue === 'string' && typeof target[key] === 'string' && 
                    key === 'content') {
                    target[key] += sourceValue; // Only concatenate content
                } 
                // For role, id, type and other non-concatenated fields
                else if (nonConcatenatedFields.includes(key) || target[key] === undefined || target[key] === '') {
                    target[key] = sourceValue; // Direct assignment (no concatenation)
                }
                else {
                    // Handle other primitive values - direct assignment
                    target[key] = sourceValue;
                }
            }
        }
    }
}