import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";

export type OptimizedMedia = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  originalSize: number;
  optimizedSize: number;
  durationMs: number | null;
  warnLarge: boolean;
  usedFfmpeg: boolean;
};

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

export async function optimizeAudio(input: Buffer, mimeType: string): Promise<OptimizedMedia> {
  const originalSize = input.length;
  try {
    const id = randomUUID();
    const src = path.join(tmpdir(), `${id}-in`);
    const dest = path.join(tmpdir(), `${id}.mp3`);
    await writeFile(src, input);
    await run("ffmpeg", ["-y", "-i", src, "-codec:a", "libmp3lame", "-b:a", "96k", dest]);
    const out = await readFile(dest);
    await unlink(src).catch(() => undefined);
    await unlink(dest).catch(() => undefined);
    return {
      buffer: out,
      contentType: "audio/mpeg",
      extension: ".mp3",
      originalSize,
      optimizedSize: out.length,
      durationMs: null,
      warnLarge: out.length > 250 * 1024,
      usedFfmpeg: true,
    };
  } catch {
    return {
      buffer: input,
      contentType: mimeType || "audio/mpeg",
      extension: ".mp3",
      originalSize,
      optimizedSize: originalSize,
      durationMs: null,
      warnLarge: originalSize > 250 * 1024,
      usedFfmpeg: false,
    };
  }
}

export async function optimizeVideo(input: Buffer, mimeType: string): Promise<OptimizedMedia> {
  const originalSize = input.length;
  try {
    const id = randomUUID();
    const src = path.join(tmpdir(), `${id}-in`);
    const dest = path.join(tmpdir(), `${id}.mp4`);
    await writeFile(src, input);
    await run("ffmpeg", [
      "-y",
      "-i",
      src,
      "-vf",
      "scale='min(720,iw)':-2",
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "veryfast",
      "-an",
      "-movflags",
      "+faststart",
      dest,
    ]);
    const out = await readFile(dest);
    await unlink(src).catch(() => undefined);
    await unlink(dest).catch(() => undefined);
    return {
      buffer: out,
      contentType: "video/mp4",
      extension: ".mp4",
      originalSize,
      optimizedSize: out.length,
      durationMs: null,
      warnLarge: out.length > 800 * 1024,
      usedFfmpeg: true,
    };
  } catch {
    return {
      buffer: input,
      contentType: mimeType || "video/mp4",
      extension: ".mp4",
      originalSize,
      optimizedSize: originalSize,
      durationMs: null,
      warnLarge: true,
      usedFfmpeg: false,
    };
  }
}
