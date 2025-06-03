/**
 * This merge function is used to recursively merge properties from a source object into a target object.
 * It handles nested objects and arrays, ensuring that properties are merged correctly.
 * 
 * It is mainly used to accumulate deltas from streaming responses, allowing for incremental updates
 * to the target object without losing existing properties.
 * 
 * * The function modifies the target object in place, so it does not return a new object.
 * 
 * @param target 
 * @param source 
 * @returns 
 */
export const mergeDelta = (target: any, source: any): void => {
    if (typeof source !== 'object' || source === null) {
        return; // Base case, nothing to merge
    }
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && source[key] !== null) {
                // If target[key] is not an object, initialize it
                if (typeof target[key] !== 'object' || target[key] === null) {
                    target[key] = {};
                }
                mergeDelta(target[key], source[key]); // Recurse
            } else {
                target[key] = source[key]; // Direct assignment for primitive values
            }
        }
    }
}