import fs from 'fs';
import path from 'path';

/**
 * Gets the caller file path to determine where to store snapshots
 */
function getCallerFilePath() {
  const originalStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 20;
  const stack = new Error().stack?.split('\n') || [];
  Error.stackTraceLimit = originalStackTraceLimit;

  // Find the test file in the stack trace
  const callerLine = stack.find(line => 
    (line.includes('.test.') || line.includes('.spec.')) && 
    !line.includes('withSnapshot')
  );

  if (!callerLine) return process.cwd();

  // Extract the file path from the stack trace line
  const match = callerLine.match(/\((.+?):[0-9]+:[0-9]+\)/) || 
                callerLine.match(/at (.+?):[0-9]+:[0-9]+/);
  
  return match ? path.dirname(match[1]) : process.cwd();
}

/**
 * Utility function to handle snapshot testing for objects that may change over time.
 * 
 * @param key Unique identifier for the snapshot
 * @param callback Function that returns the object to be snapshotted
 * @param options Configuration options
 * @returns The result from the callback or the saved snapshot
 */
export async function withSnapshot<T>(
  key: string,
  callback: () => Promise<T> | T,
  options: {
    /** Directory where snapshots are stored */
    snapshotDir?: string;
    /** Force using the real implementation instead of snapshot */
    useRealImplementation?: boolean;
    /** Custom serializer for the snapshot */
    serializer?: (data: T) => string;
    /** Custom deserializer for the snapshot */
    deserializer?: (data: string) => T;
  } = {}
): Promise<T> {
  // If snapshotDir isn't explicitly provided, determine it from the caller file
  const defaultSnapshotDir = path.join(getCallerFilePath(), '__snapshots__');

  const {
    snapshotDir = defaultSnapshotDir,
    useRealImplementation = process.env.UPDATE_SNAPSHOTS === 'true',
    serializer = (data) => JSON.stringify(data, null, 2),
    deserializer = (data) => JSON.parse(data),
  } = options;

  // Ensure the filename is safe
  const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
  const snapshotPath = path.join(snapshotDir, `${safeKey}.snapshot.json`);

  // If we want to use the real implementation or the snapshot doesn't exist
  if (useRealImplementation || !fs.existsSync(snapshotPath)) {
    const result = await Promise.resolve(callback());

    // Ensure the directory exists
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    // Save the result to a snapshot file
    fs.writeFileSync(snapshotPath, serializer(result));
    return result;
  }

  // Return the snapshot if it exists
  const snapshot = deserializer(fs.readFileSync(snapshotPath, 'utf-8'));
  return snapshot;
}