import express, { Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import { BUCKET_NAME, minioClient } from "./minio";

const router = express.Router();

// --- MOD A: Traditional Upload (Proxy) ---

// Configure Multer for disk storage (simulating temp server storage)
const upload = multer({ dest: "uploads/" }); // Temporary storage folder

router.post(
  "/traditional/upload",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).send("No file uploaded.");
        return;
      }

      const filePath = req.file.path;
      const metaData = {
        "Content-Type": req.file.mimetype,
      };

      console.log(
        `[Traditional] Uploading ${req.file.originalname} (size: ${req.file.size}) via server...`
      );

      // Streaming from local disk to MinIO
      await minioClient.fPutObject(
        BUCKET_NAME,
        req.file.originalname,
        filePath,
        metaData
      );

      // Cleanup local file
      fs.unlinkSync(filePath);

      console.log(`[Traditional] Upload complete: ${req.file.originalname}`);
      res.json({
        message: "File uploaded successfully (Traditional Mode)",
        filename: req.file.originalname,
      });
    } catch (err) {
      console.error("[Traditional] Upload failed:", err);
      res.status(500).send("Upload failed.");
    }
  }
);

// Mod A: Traditional Streaming (Proxy)
router.get(
  "/traditional/video/:filename",
  async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      console.log(`[Traditional] Streaming ${filename} via server proxy...`);

      const dataStream = await minioClient.getObject(BUCKET_NAME, filename);

      // Pipe the stream directly to the response
      dataStream.pipe(res);

      dataStream.on("error", (err) => {
        console.error("[Traditional] Stream error:", err);
        res.status(500).send("Stream error");
      });
    } catch (err) {
      console.error("[Traditional] Get object error:", err);
      res.status(404).send("File not found");
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

    // Generate Presigned PUT URL (valid for 15 mins)
    // Note: client can PUT directly to this URL
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

      // Generate Presigned GET URL (valid for 24 hours)
      // Allows direct browser access (byte-range capable)
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
    const stream = minioClient.listObjects(BUCKET_NAME, "", true);

    stream.on("data", (obj) => objects.push(obj));
    stream.on("end", () => res.json(objects));
    stream.on("error", (err) => {
      console.error("[MinIO] List objects error:", err);
      res.status(500).send("Error listing videos");
    });
  } catch (err) {
    console.error("[MinIO] Unexpected error:", err);
    res.status(500).send("Internal server error");
  }
});

router.delete("/videos/:filename", async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    await minioClient.removeObject(BUCKET_NAME, filename);
    console.log(`[MinIO] Deleted object: ${filename}`);
    res.json({ message: "Video deleted successfully" });
  } catch (err) {
    console.error("[MinIO] Delete error:", err);
    res.status(500).send("Error deleting video");
  }
});

export default router;
