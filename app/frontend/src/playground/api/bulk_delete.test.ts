import { describe, it, expect, vi } from "vitest";
import { deleteAllRemoteSessions } from "./storage";

global.fetch = vi.fn();

describe("deleteAllRemoteSessions", () => {
  it("calls the correct endpoint and returns formatted data on 200", async () => {
    const mockData = { deletedCount: 5, failed: [], message: "Success" };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await deleteAllRemoteSessions({ accessToken: "test-token" });

    expect(fetch).toHaveBeenCalledWith("/api/playground/sessions", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-token",
      },
    });
    expect(result).toEqual({ deletedCount: 5, failed: [], message: "Success" });
  });

  it("handles partial failure (207) correctly", async () => {
    const mockData = { deletedCount: 2, failed: ["blob1"], message: "Partial failure" };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 207,
      json: async () => mockData,
    });

    const result = await deleteAllRemoteSessions({ accessToken: "test-token" });

    expect(result).toEqual({ deletedCount: 2, failed: ["blob1"], message: "Partial failure" });
  });

  it("returns empty count on 204 No Content", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await deleteAllRemoteSessions({ accessToken: "test-token" });
    expect(result).toEqual({ deletedCount: 0, failed: [] });
  });

  it("throws error for missing access token", async () => {
    await expect(deleteAllRemoteSessions({ accessToken: "" })).rejects.toThrow("accessToken is required");
  });
});
