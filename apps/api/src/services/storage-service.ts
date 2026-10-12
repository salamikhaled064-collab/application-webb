/**
 * Storage abstraction: local filesystem OR S3-compatible (R2 / S3 / B2).
 * On Render, API and Worker MUST share the same object storage.
 */
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { randomToken } from "../lib/crypto";
import { config } from "../config";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ensureStorageDirs() {
  if (config.storageProvider !== "local") return;
  for (const d of [
    config.storageDir,
    path.join(config.storageDir, "uploads"),
    path.join(config.storageDir, "videos"),
    path.join(config.storageDir, "temp"),
  ]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function validateImageMime(mime: string): boolean {
  return ALLOWED_MIMES.has(mime);
}

export function getAbsolutePath(storageKey: string): string {
  const base = path.resolve(config.storageDir);
  if (
    typeof storageKey !== "string" ||
    storageKey.includes("\0") ||
    storageKey.startsWith("/") ||
    storageKey.startsWith("\\") ||
    storageKey.includes("..")
  ) {
    throw new Error("Invalid storage key");
  }
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(base, normalized);
  if (!absolute.startsWith(base + path.sep) && absolute !== base) {
    throw new Error("Path traversal blocked");
  }
  return absolute;
}

function s3Enabled(): boolean {
  return (
    config.storageProvider === "s3" &&
    Boolean(process.env.S3_BUCKET) &&
    Boolean(process.env.S3_ACCESS_KEY_ID) &&
    Boolean(process.env.S3_SECRET_ACCESS_KEY)
  );
}

/** Lazy AWS SDK import – only when S3 is configured */
async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT), // required for R2/B2
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

export async function putObject(
  storageKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (s3Enabled()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }
  ensureStorageDirs();
  const abs = getAbsolutePath(storageKey);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

export async function getObjectBuffer(storageKey: string): Promise<Buffer> {
  if (s3Enabled()) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const out = await client.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: storageKey })
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }
  return fs.readFileSync(getAbsolutePath(storageKey));
}

export function createReadStream(storageKey: string): fs.ReadStream | null {
  if (s3Enabled()) return null; // use getObjectBuffer for S3
  return fs.createReadStream(getAbsolutePath(storageKey));
}

export async function objectExists(storageKey: string): Promise<boolean> {
  try {
    if (s3Enabled()) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await getS3Client();
      await client.send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: storageKey })
      );
      return true;
    }
    return fs.existsSync(getAbsolutePath(storageKey));
  } catch {
    return false;
  }
}

export function saveUpload(
  buffer: Buffer,
  _originalName: string,
  mimeType: string
): { storageKey: string; absolutePath: string } {
  ensureStorageDirs();
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const storageKey = `uploads/${randomToken(16)}.${ext}`;

  if (s3Enabled()) {
    // sync wrapper – callers should prefer saveUploadAsync
    throw new Error("Use saveUploadAsync when STORAGE_PROVIDER=s3");
  }

  const absolutePath = getAbsolutePath(storageKey);
  fs.writeFileSync(absolutePath, buffer);
  return { storageKey, absolutePath };
}

export async function saveUploadAsync(
  buffer: Buffer,
  _originalName: string,
  mimeType: string
): Promise<{ storageKey: string }> {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const storageKey = `uploads/${randomToken(16)}.${ext}`;
  await putObject(storageKey, buffer, mimeType);
  return { storageKey };
}

export function deleteFile(storageKey: string) {
  (async () => {
    try {
      if (s3Enabled()) {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const client = await getS3Client();
        await client.send(
          new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: storageKey })
        );
        return;
      }
      const p = getAbsolutePath(storageKey);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  })();
}

export function readFileAsBase64DataUrl(storageKey: string, mimeType: string): string {
  // sync path for local; for S3 worker should use async version
  if (s3Enabled()) {
    throw new Error("Use readFileAsBase64DataUrlAsync with S3");
  }
  const buf = fs.readFileSync(getAbsolutePath(storageKey));
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

export async function readFileAsBase64DataUrlAsync(
  storageKey: string,
  mimeType: string
): Promise<string> {
  const buf = await getObjectBuffer(storageKey);
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

export function fileExists(storageKey: string): boolean {
  try {
    if (s3Enabled()) return false; // use objectExists async
    return fs.existsSync(getAbsolutePath(storageKey));
  } catch {
    return false;
  }
}

/**
 * Download remote video with size limit, stream to local or S3.
 */
export async function downloadVideoToStorage(
  remoteUrl: string,
  maxBytes: number
): Promise<{ storageKey: string; bytes: number }> {
  const storageKey = `videos/${randomToken(16)}.mp4`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const res = await fetch(remoteUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json") || ct.includes("html") || ct.includes("text/")) {
      throw new Error(`MIME invalide: ${ct}`);
    }

    const body = res.body;
    if (!body) throw new Error("Corps vide");

    // Collect with size limit (chunked – not one arrayBuffer for huge files)
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) throw new Error("Vidéo trop volumineuse");
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    await putObject(storageKey, buffer, "video/mp4");
    return { storageKey, bytes: total };
  } finally {
    clearTimeout(timeout);
  }
}
