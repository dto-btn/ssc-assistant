#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import { once } from "node:events";

const HEADER_OVERFLOW = "HPE_HEADER_OVERFLOW";

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (typeof value === "undefined" || value.startsWith("--")) return fallback;
  return value;
};

const hasFlag = (name) => args.includes(name);

const type = String(getArg("--type", "cookie")).toLowerCase();
const maxHeaderSize = Number(getArg("--max-header-size", "1024"));
const headerBytes = Number(getArg("--header-bytes", "8192"));
const targetUrl = getArg("--url", "");
const verbose = hasFlag("--verbose");
const findLimit = hasFlag("--find-limit");
const insecure = hasFlag("--insecure");
const minBytes = Number(getArg("--min-bytes", "256"));
const maxBytes = Number(getArg("--max-bytes", "65536"));

if (!["cookie", "authorization"].includes(type)) {
  console.error("Invalid --type. Use 'cookie' or 'authorization'.");
  process.exit(1);
}

if (!Number.isFinite(maxHeaderSize) || maxHeaderSize <= 0) {
  console.error("Invalid --max-header-size. Provide a positive number.");
  process.exit(1);
}

if (!Number.isFinite(headerBytes) || headerBytes <= 0) {
  console.error("Invalid --header-bytes. Provide a positive number.");
  process.exit(1);
}

if (!Number.isFinite(minBytes) || minBytes <= 0) {
  console.error("Invalid --min-bytes. Provide a positive number.");
  process.exit(1);
}

if (!Number.isFinite(maxBytes) || maxBytes <= 0 || maxBytes < minBytes) {
  console.error("Invalid --max-bytes. Must be >= --min-bytes and positive.");
  process.exit(1);
}

const byteLength = (value) => Buffer.byteLength(value, "utf8");

const buildHeaderValue = (bytes) => {
  if (type === "authorization") {
    const prefix = "Bearer ";
    const payload = Math.max(0, bytes - byteLength(prefix));
    return prefix + "a".repeat(payload);
  }

  const prefix = "session=";
  const payload = Math.max(0, bytes - byteLength(prefix));
  return prefix + "b".repeat(payload);
};

const buildHeaders = (bytes) => {
  const value = buildHeaderValue(bytes);
  const headers = {};
  if (type === "authorization") {
    headers.Authorization = value;
  } else {
    headers.Cookie = value;
  }
  return headers;
};

const find431Boundary = async (url, min, max) => {
  let low = min;
  let high = max;
  let lastOk = null;
  let first431 = null;
  let attempts = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    attempts += 1;
    const headers = buildHeaders(mid);
    const result = await send(url, headers);
    const status = Number(result.statusCode || 0);

    if (status === 431) {
      first431 = mid;
      high = mid - 1;
    } else {
      lastOk = mid;
      low = mid + 1;
    }
  }

  return { lastOk, first431, attempts };
};

const send = async (url, headers) => {
  const parsed = new URL(url);
  const mod = parsed.protocol === "https:" ? https : http;

  return await new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname || "/",
        method: "GET",
        headers,
        rejectUnauthorized: parsed.protocol === "https:" ? !insecure : undefined,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("error", reject);
    req.end();
  });
};

const startHarness = async () => {
  const server = http.createServer({ maxHeaderSize }, (_req, res) => {
    res.statusCode = 200;
    res.end("ok");
  });

  server.on("clientError", (err, socket) => {
    if (err?.code === HEADER_OVERFLOW) {
      socket.end(
        "HTTP/1.1 431 Request Header Fields Too Large\r\n" +
          "Connection: close\r\n" +
          "\r\n",
      );
      return;
    }
    socket.destroy();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine harness listen address");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  };
};

const headerName = type === "authorization" ? "Authorization" : "Cookie";
const headers = buildHeaders(headerBytes);
const value = headers[headerName];

console.log("Header reproduction configuration:");
console.log(`- Header: ${headerName}`);
if (!findLimit) {
  console.log(`- Header bytes requested: ${headerBytes}`);
  console.log(`- Header bytes actual: ${byteLength(value)}`);
}
console.log(`- maxHeaderSize: ${maxHeaderSize}`);
if (targetUrl) {
  console.log(`- Target URL: ${targetUrl}`);
} else {
  console.log("- Target URL: local harness (auto-start)");
}
if (insecure) {
  console.log("- TLS validation: disabled via --insecure");
}
if (findLimit) {
  console.log(`- Probe mode: binary search from ${minBytes} to ${maxBytes} bytes`);
}

if (verbose) {
  console.log("- Header preview:", value.slice(0, 120) + (value.length > 120 ? "..." : ""));
}

let server;
let url = targetUrl;

const main = async () => {
  try {
    if (!url) {
      const harness = await startHarness();
      server = harness.server;
      url = harness.url;
    }

    if (findLimit) {
      const boundary = await find431Boundary(url, minBytes, maxBytes);
      console.log("Boundary probe result:");
      console.log(`- Attempts: ${boundary.attempts}`);
      console.log(`- Largest non-431 header bytes: ${boundary.lastOk ?? "none found"}`);
      console.log(`- Smallest 431 header bytes: ${boundary.first431 ?? "none found"}`);
      if (boundary.first431 == null) {
        console.log("- Outcome: 431 not observed in tested range; increase --max-bytes.");
      }
      return;
    }

    const result = await send(url, headers);

    console.log("Response:");
    console.log(`- HTTP status: ${result.statusCode}`);
    if (result.statusCode === 431) {
      console.log("- Outcome: reproduced HTTP 431 successfully.");
    } else {
      console.log("- Outcome: did not receive 431. Increase --header-bytes or reduce server max header limit.");
    }
    if (verbose) {
      console.log("- Response body:", result.body || "<empty>");
    }
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }
};

main().catch((err) => {
  if (err && err.code === "SELF_SIGNED_CERT_IN_CHAIN") {
    console.error("TLS certificate validation failed (SELF_SIGNED_CERT_IN_CHAIN).");
    console.error("For testing only, rerun with --insecure to bypass TLS validation:");
    console.error("npm run repro:431 -- --url <https-url> --type cookie --find-limit --insecure");
  } else {
    console.error(err);
  }
  process.exit(1);
});
