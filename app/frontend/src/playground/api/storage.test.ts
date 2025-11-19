import { describe, it, expect } from "vitest";

import { normalizePreviewUrl } from "./storage";

describe("normalizePreviewUrl", () => {
  it("decodes already normalized paths", () => {
    const result = normalizePreviewUrl("/files/%20encoded%20name.pdf");
    expect(result).toBe("/files/ encoded name.pdf");
  });

  it("adds a leading slash for relative paths", () => {
    const result = normalizePreviewUrl("relative/path.txt");
    expect(result).toBe("/relative/path.txt");
  });

  it("falls back to blobName when rawUrl is missing", () => {
    const result = normalizePreviewUrl(undefined, "folder/blob.bin");
    expect(result).toBe("/folder/blob.bin");
  });
});
