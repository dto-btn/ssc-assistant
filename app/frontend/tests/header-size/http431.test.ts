// @vitest-environment node

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

const HEADER_OVERFLOW = "HPE_HEADER_OVERFLOW";

const createHarness = async (maxHeaderSize: number) => {
  const server = http.createServer({ maxHeaderSize }, (_req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("ok");
  });

  // Keep behavior deterministic across Node versions.
  server.on("clientError", (err, socket) => {
    if ((err as NodeJS.ErrnoException).code === HEADER_OVERFLOW) {
      socket.end(
        "HTTP/1.1 431 Request Header Fields Too Large\r\n" +
          "Connection: close\r\n" +
          "\r\n",
      );
      return;
    }
    socket.destroy();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${port}`,
  };
};

const requestStatus = async (
  url: string,
  headers: Record<string, string>,
): Promise<number | undefined> => {
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "GET",
        headers,
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );

    req.on("error", reject);
    req.end();
  });
};

const buildLargeBearer = (sizeInBytes: number): string => {
  const prefix = "Bearer ";
  const payloadSize = Math.max(0, sizeInBytes - Buffer.byteLength(prefix, "utf8"));
  return prefix + "a".repeat(payloadSize);
};

const buildLargeCookie = (sizeInBytes: number): string => {
  const prefix = "session=";
  const payloadSize = Math.max(0, sizeInBytes - Buffer.byteLength(prefix, "utf8"));
  return prefix + "b".repeat(payloadSize);
};

describe("HTTP 431 reproduction harness", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (!server) continue;
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("accepts small headers under maxHeaderSize", async () => {
    const harness = await createHarness(1024);
    servers.push(harness.server);

    const status = await requestStatus(harness.url, {
      Authorization: "Bearer short-token",
      Cookie: "session=small",
    });

    expect(status).toBe(200);
  });

  it("returns 431 for oversized Authorization bearer header", async () => {
    const harness = await createHarness(1024);
    servers.push(harness.server);

    const status = await requestStatus(harness.url, {
      Authorization: buildLargeBearer(4096),
    });

    expect(status).toBe(431);
  });

  it("returns 431 for oversized Cookie header", async () => {
    const harness = await createHarness(1024);
    servers.push(harness.server);

    const status = await requestStatus(harness.url, {
      Cookie: buildLargeCookie(4096),
    });

    expect(status).toBe(431);
  });
});
