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
export const mergeOpenAiDelta = (target: any, source: any): void => {

}