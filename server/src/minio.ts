import dotenv from "dotenv";
import * as Minio from "minio";

dotenv.config();

// MinIO Client Configuration
export const minioClient = new Minio.Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

// Bucket Name
export const BUCKET_NAME = "videos";

// Ensure bucket exists on startup
export const initializeMinio = async () => {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, "us-east-1");
      console.log(`Bucket '${BUCKET_NAME}' created successfully.`);

      // Set bucket policy to public read (simplified for PoC)
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`Bucket '${BUCKET_NAME}' policy set to public read.`);
    } else {
      console.log(`Bucket '${BUCKET_NAME}' already exists.`);
    }
  } catch (err) {
    console.error("Error initializing MinIO:", err);
  }
};
