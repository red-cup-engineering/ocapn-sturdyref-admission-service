#!/usr/bin/env node

import { createServer } from "node:http";
import { createSturdyRefStore } from "../src/admission.mjs";

function required(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value === "") throw new Error(`${name} is required`);
  return value;
}

const store = createSturdyRefStore({ root: required("OCAPN_DATA_ROOT") });
const maximum = Number(required("MAX_REQUEST_BYTES"));
if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("MAX_REQUEST_BYTES must be a positive integer");

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, operation: "admit-ocapn-sturdyref" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/admit") {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > maximum) throw new Error("admission request exceeds configured boundary");
      chunks.push(chunk);
    }
    const result = await store.admit(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.setHeader("content-type", "application/json");
    response.writeHead(result.admitted ? 200 : 403).end(JSON.stringify(result));
  } catch (error) {
    response.setHeader("content-type", "application/json");
    response.writeHead(400).end(JSON.stringify({
      type: "OCapNSturdyRefAdmissionRefusal",
      reason: error instanceof Error ? error.message : String(error),
    }));
  }
});

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "18894");
server.listen(port, host, () => process.stdout.write(`${JSON.stringify({
  type: "OCapNSturdyRefAdmissionListening",
  host,
  port,
})}\n`));
