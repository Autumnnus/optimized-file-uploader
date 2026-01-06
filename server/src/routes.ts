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

// --- Multipart Upload Endpoints ---

router.post(
  "/optimized/initiate-multipart",
  async (req: Request, res: Response) => {
    try {
      const { filename, contentType } = req.body;
      if (!filename) {
        // contentType is optional for initiateMultipartUpload in newer sdk, but good to have
        res.status(400).send("Filename required");
        return;
      }
      // MinIO SDK doesn't expose initiateMultipartUpload directly in a simple way for presigned flows normally,
      // but we can use presignedUrl for each part.
      // Actually, for a pure client-side multipart upload using presigned URLs, we need the UploadID.
      // The node minio client hides some of this. However, we can use the `initiateMultipartUpload` method if available
      // or standard S3 API calls.
      // MinIO JS Client 7.x+ exposes `initiateMultipartUpload` but it might need to be called on valid bucket/object.

      // Let's use a workaround: The MinIO client is a wrapper around S3.
      // We can use the underlying `makeRequest` or similar if needed, BUT
      // standard `minio` library `presignedPutObject` is for single PUTs.
      // To do multipart with presigned URLs, we need to generate a specific URL for each part that includes the uploadId.
      //
      // WE WILL USE A SIMPLER APPROACH FOR THIS DEMO which is robust:
      // We will assume the client manages parts.
      // BUT we need an UploadID from MinIO to start.

      // Since `minio` package is high-level, let's look at `listMultipartUploads` etc.
      // Using `minioClient.initiateMultipartUpload` is the standard way.

      const uploadId = await minioClient.initiateNewMultipartUpload(
        BUCKET_NAME,
        filename,
        {
          "Content-Type": contentType || "application/octet-stream",
        }
      );

      console.log(
        `[Optimized] Initiated Multipart Upload for: ${filename}, ID: ${uploadId}`
      );
      res.json({ uploadId, filename });
    } catch (err) {
      console.error("[Optimized] Error initiating multipart upload:", err);
      res.status(500).send("Error initiating multipart upload");
    }
  }
);

router.post(
  "/optimized/get-multipart-url",
  async (req: Request, res: Response) => {
    try {
      const { filename, uploadId, partNumber } = req.body;
      if (!filename || !uploadId || !partNumber) {
        res.status(400).send("Missing parameters");
        return;
      }

      // Generate Presigned URL for a specific part
      // minioClient.presignedUrl('PUT', bucket, object, expires, { 'uploadId': ..., 'partNumber': ... })
      // The library signature is: presignedUrl(method, bucket, object, expiry, queryParams)
      const presignedUrl = await minioClient.presignedUrl(
        "PUT",
        BUCKET_NAME,
        filename,
        24 * 60 * 60, // 1 day
        {
          uploadId: uploadId,
          partNumber: partNumber.toString(),
        }
      );

      res.json({ url: presignedUrl });
    } catch (err) {
      console.error("[Optimized] Error generating part URL:", err);
      res.status(500).send("Error generating part URL");
    }
  }
);

router.post(
  "/optimized/complete-multipart",
  async (req: Request, res: Response) => {
    try {
      const { filename, uploadId, parts } = req.body;
      if (!filename || !uploadId || !parts) {
        res.status(400).send("Missing parameters");
        return;
      }

      // parts must be an array of { etag, part: partNumber }
      // MinIO client expects: completeMultipartUpload(bucket, object, uploadId, etags[])
      // etags format: { ETag: '...', PartNumber: 1 }

      await minioClient.completeMultipartUpload(
        BUCKET_NAME,
        filename,
        uploadId,
        parts
      );

      console.log(`[Optimized] Completed Multipart Upload for: ${filename}`);
      res.json({ message: "Upload complete" });
    } catch (err) {
      console.error("[Optimized] Error completing multipart upload:", err);
      res.status(500).send("Error completing multipart upload");
    }
  }
);

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
