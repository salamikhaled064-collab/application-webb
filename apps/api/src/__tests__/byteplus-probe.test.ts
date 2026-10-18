import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http from "http";
import { probeVerdict, probeBytePlusModels } from "../lib/byteplus-probe";

describe("verdict du test de clé BytePlus", () => {
  it("404 modèle introuvable → pas d'accès", () => {
    expect(probeVerdict(404, "InvalidEndpointOrModel.NotFound", "The model or endpoint x does not exist or you do not have access to it")).toBe("no_access");
  });
  it("401 → clé refusée", () => expect(probeVerdict(401, "AuthenticationError", "bad key")).toBe("key_refused"));
  it("400 paramètre invalide → modèle reconnu", () => expect(probeVerdict(400, "InvalidParameter", "content is required")).toBe("recognized"));
  it("429 → limite", () => expect(probeVerdict(429, "", "slow down")).toBe("rate_limited"));
  it("5xx → erreur", () => expect(probeVerdict(503, "", "busy")).toBe("error"));
});

describe("test de clé contre un faux serveur BytePlus", () => {
  let server: http.Server;
  let port = 0;
  const bodies: string[] = [];
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        bodies.push(b);
        const m = JSON.parse(b).model;
        const send = (s: number, o: unknown) => {
          res.writeHead(s, { "content-type": "application/json" });
          res.end(JSON.stringify(o));
        };
        if (req.headers.authorization !== "Bearer GOOD") return send(401, { error: { code: "AuthenticationError", message: "bad key" } });
        if (m === "ok-model") return send(400, { error: { code: "InvalidParameter", message: "content must not be empty" } });
        return send(404, { error: { code: "InvalidEndpointOrModel.NotFound", message: `The model or endpoint ${m} does not exist or you do not have access to it.` } });
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as any).port;
  });
  afterAll(() => server.close());

  it("distingue modèle accessible / inaccessible et n'envoie jamais de contenu réel", async () => {
    const r = await probeBytePlusModels("GOOD", `http://localhost:${port}/api/v3`, ["ok-model", "no-model"]);
    expect(r.map((x) => x.verdict)).toEqual(["recognized", "no_access"]);
    expect(bodies.every((b) => JSON.parse(b).content.length === 0)).toBe(true); // requêtes volontairement vides
  });

  it("clé refusée", async () => {
    const r = await probeBytePlusModels("BAD", `http://localhost:${port}/api/v3`, ["ok-model"]);
    expect(r[0].verdict).toBe("key_refused");
  });
});
