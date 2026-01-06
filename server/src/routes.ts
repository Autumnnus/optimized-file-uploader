import express, { Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { BUCKET_NAME, minioClient } from "./minio";

const router = express.Router();

const PERSISTENT_STORAGE = path.join(process.cwd(), "uploads", "permanent");
if (!fs.existsSync(PERSISTENT_STORAGE)) {
  fs.mkdirSync(PERSISTENT_STORAGE, { recursive: true });
}

// --- MOD A: Traditional Upload (Local FS) ---

const upload = multer({ dest: "uploads/temp/" });

router.post(
  "/traditional/upload",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).send("No file uploaded.");
        return;
      }

      const tempPath = req.file.path;
      const targetPath = path.join(PERSISTENT_STORAGE, req.file.originalname);

      console.log(
        `[Traditional] Moving ${req.file.originalname} to permanent storage...`
      );

      // Moving file from temp to permanent storage
      fs.renameSync(tempPath, targetPath);

      console.log(`[Traditional] Upload complete: ${req.file.originalname}`);
      res.json({
        message: "File uploaded successfully (Traditional Mode - Local FS)",
        filename: req.file.originalname,
      });
    } catch (err) {
      console.error("[Traditional] Upload failed:", err);
      res.status(500).send("Upload failed.");
    }
  }
);

// Mod A: Traditional Streaming (Local FS)
router.get(
  "/traditional/video/:filename",
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(PERSISTENT_STORAGE, filename);

      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }

      console.log(`[Traditional] Streaming ${filename} from local disk...`);

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error("[Traditional] Stream error:", err);
      res.status(500).send("Stream error");
    }
  }
);

// --- MOD B: Optimized Upload (Presigned URLs) ---

router.get("/optimized/get-upload-url", async (req: Request, res: Response) => {
  try {
    const filename = req.query.filename as string;
    if (!filename) {
      res.status(400).send("Filename required");
      return;
    }

    const presignedUrl = await minioClient.presignedPutObject(
      BUCKET_NAME,
      filename,
      24 * 60 * 60
    );

    console.log(`[Optimized] Generated Upload URL for: ${filename}`);
    res.json({ url: presignedUrl, filename });
  } catch (err) {
    console.error("[Optimized] Error generating upload URL:", err);
    res.status(500).send("Error generating URL");
  }
});

router.get(
  "/optimized/get-download-url/:filename",
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;

      const presignedUrl = await minioClient.presignedGetObject(
        BUCKET_NAME,
        filename,
        24 * 60 * 60
      );

      console.log(`[Optimized] Generated Download URL for: ${filename}`);
      res.json({ url: presignedUrl });
    } catch (err) {
      console.error("[Optimized] Error generating download URL:", err);
      res.status(500).send("Error generating URL");
    }
  }
);

router.get("/videos", async (_req: Request, res: Response) => {
  try {
    const objects: any[] = [];

    // 1. Get files from MinIO
    const minioStream = minioClient.listObjects(BUCKET_NAME, "", true);

    const minioPromise = new Promise((resolve, reject) => {
      minioStream.on("data", (obj) =>
        objects.push({ name: obj.name, size: obj.size, source: "minio" })
      );
      minioStream.on("end", resolve);
      minioStream.on("error", reject);
    });

    // 2. Get files from local storage
    const localFiles = fs.readdirSync(PERSISTENT_STORAGE);
    localFiles.forEach((file) => {
      const stats = fs.statSync(path.join(PERSISTENT_STORAGE, file));
      if (stats.isFile()) {
        objects.push({
          name: file,
          size: stats.size,
          source: "local",
        });
      }
    });

    await minioPromise;

    // Deduplicate or just return all (if names are same, they might conflict in UI)
    // For this example, we'll just return all.
    res.json(objects);
  } catch (err) {
    console.error("[Library] Error listing videos:", err);
    res.status(500).send("Error listing videos");
  }
});

router.delete("/videos/:filename", async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;

    // Try deleting from local first
    const localPath = path.join(PERSISTENT_STORAGE, filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`[Local] Deleted file: ${filename}`);
    }

    // Also try deleting from MinIO
    await minioClient.removeObject(BUCKET_NAME, filename).catch(() => {
      // Ignore if not in MinIO
    });

    res.json({ message: "Video deleted successfully" });
  } catch (err) {
    console.error("[Delete] Error deleting video:", err);
    res.status(500).send("Error deleting video");
  }
});

export default router;
