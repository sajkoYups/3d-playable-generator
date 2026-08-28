import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export type StoredObject = {
  key: string;
  url: string;
};

function getLocalRoot() {
  return path.resolve(process.env.STORAGE_LOCAL_PATH || "./storage");
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
}

export async function uploadBuffer(
  buffer: Buffer,
  options: { fileName: string; contentType: string; folder?: string },
): Promise<StoredObject> {
  const ext = path.extname(options.fileName) || "";
  const key = `${options.folder || "assets"}/${randomUUID()}${ext}`;
  const driver = process.env.STORAGE_DRIVER || "local";

  if (driver === "s3") {
    const client = getS3Client();
    const bucket = process.env.S3_BUCKET!;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType,
      }),
    );
    const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "") || "";
    return { key, url: `${base}/${key}` };
  }

  const fullPath = path.join(getLocalRoot(), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { key, url: `/api/storage/${key}` };
}

export async function deleteObject(key: string): Promise<void> {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "s3") {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      }),
    );
    return;
  }
  const fullPath = path.join(getLocalRoot(), key);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing
  }
}

export async function readObjectBuffer(keyOrUrl: string): Promise<Buffer | null> {
  const driver = process.env.STORAGE_DRIVER || "local";

  if (keyOrUrl.startsWith("data:")) {
    const base64 = keyOrUrl.split(",")[1];
    if (!base64) return null;
    return Buffer.from(base64, "base64");
  }

  if (
    keyOrUrl.startsWith("/demo-assets/") ||
    keyOrUrl.startsWith("/models/") ||
    keyOrUrl.startsWith("/public/")
  ) {
    const relative = keyOrUrl.replace(/^\/public\//, "").replace(/^\//, "");
    try {
      return await readFile(path.join(process.cwd(), "public", relative));
    } catch {
      return null;
    }
  }

  let key = keyOrUrl;
  if (keyOrUrl.startsWith("/api/storage/")) {
    key = keyOrUrl.replace("/api/storage/", "");
  } else if (keyOrUrl.startsWith("http")) {
    try {
      const res = await fetch(keyOrUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  if (driver === "s3") {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
        }),
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  try {
    return await readFile(path.join(getLocalRoot(), key));
  } catch {
    return null;
  }
}
