import { ConvexError } from 'convex/values';

export interface SerializedTaggedError {
  tag: string;
  data: unknown;
}

/**
 * Checks if the given error is a ConvexError containing a serialized TaggedError,
 * and if so, parses it.
 */
export function parseConvexError(error: unknown): SerializedTaggedError | null {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (data && typeof data === 'object' && 'tag' in data && 'data' in data) {
      return {
        tag: data.tag as string,
        data: data.data,
      };
    }
  }
  return null;
}

/**
 * Matches a caught error against a specific tag and runs the handler if it matches.
 */
export function catchTag<Tag extends string, Data, T>(
  error: unknown,
  tag: Tag,
  handler: (data: Data) => T
): T | null {
  const parsed = parseConvexError(error);
  if (parsed && parsed.tag === tag) {
    return handler(parsed.data as Data);
  }
  return null;
}
