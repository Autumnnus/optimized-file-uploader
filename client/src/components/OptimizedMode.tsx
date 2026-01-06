import axios from "axios";
import React, { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface OptimizedModeProps {
  initialFilename?: string | null;
  onUploadSuccess?: (filename: string) => void;
}

export const OptimizedMode: React.FC<OptimizedModeProps> = ({
  initialFilename,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const [stats, setStats] = useState<{ duration: number; size: number } | null>(
    null
  );

  useEffect(() => {
    const loadFromLibrary = async () => {
      if (initialFilename) {
        setStatus("Fetching URL from library...");
        try {
          const {
            data: { url: downloadUrl },
          } = await axios.get(
            `http://localhost:3001/api/optimized/get-download-url/${encodeURIComponent(
              initialFilename
            )}`
          );
          setVideoUrl(downloadUrl);
          setStatus("Video loaded from library");
        } catch (err) {
          console.error("Library load failed", err);
          setStatus("Library load failed");
        }
      }
    };
    loadFromLibrary();
  }, [initialFilename]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith("video/")) {
        alert("Please select a video file!");
        e.target.value = "";
        return;
      }
      setFile(selectedFile);
      setStats(null);
      setVideoUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setStatus("Getting Presigned URL...");
    const startTime = performance.now();

    try {
      // 1. Get Presigned PUT URL
      const {
        data: { url: uploadUrl, filename },
      } = await axios.get(
        `http://localhost:3001/api/optimized/get-upload-url?filename=${encodeURIComponent(
          file.name
        )}`
      );

      setStatus("Direct Upload to MinIO...");

      // 2. Upload directly to MinIO using XMLHttpRequest for progress
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
          }
        },
      });

      const endTime = performance.now();
      setStats({
        duration: (endTime - startTime) / 1000,
        size: file.size,
      });

      setStatus("Upload Complete!");
      if (onUploadSuccess) {
        onUploadSuccess(filename);
      }

      // 3. Get Presigned GET URL for playback
      const {
        data: { url: downloadUrl },
      } = await axios.get(
        `http://localhost:3001/api/optimized/get-download-url/${encodeURIComponent(
          filename
        )}`
      );
      setVideoUrl(downloadUrl);
    } catch (err) {
      console.error(err);
      setStatus("Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  const [downloadStats, setDownloadStats] = useState<{
    duration: number;
    size: number;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!videoUrl) return;

    setDownloading(true);
    const startTime = performance.now();

    try {
      // Fetch directly from presigned URL
      const response = await axios.get(videoUrl, {
        responseType: "blob",
      });

      const endTime = performance.now();
      const blob = response.data;

      setDownloadStats({
        duration: (endTime - startTime) / 1000,
        size: blob.size,
      });

      // Trigger actual download in browser
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `optimized-${file?.name || "video"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-emerald-400 to-cyan-400"></div>

      <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2">
        <span>🚀</span> Mod B: Optimized Method
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Auth via Node.js, but Data flows directly between Client & MinIO.
        <br />
        <span className="text-xs text-emerald-500 font-mono mt-1 block">
          Zero Server Load on Upload/Download
        </span>
      </p>

      <div className="space-y-4">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-emerald-900/50 file:text-emerald-400
            hover:file:bg-emerald-900 cursor-pointer"
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={cn(
            "w-full py-2 px-4 rounded-lg font-medium transition-colors",
            uploading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          {uploading ? "Uploading Directly..." : "Upload via Direct Link"}
        </button>

        {uploading && (
          <div className="w-full bg-gray-700 rounded-full h-2.5 dark:bg-gray-700 mt-2 overflow-hidden">
            <div
              className="bg-emerald-400 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {status && (
          <div className="text-sm text-center font-mono text-gray-300 bg-gray-900/50 p-2 rounded">
            {status}{" "}
            {uploadProgress > 0 &&
              uploadProgress < 100 &&
              `(${uploadProgress}%)`}
          </div>
        )}

        {stats && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex flex-col gap-1">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Yükleme İstatistikleri
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">Boyut:</div>
              <div className="text-white font-mono">
                {formatSize(stats.size)}
              </div>
              <div className="text-gray-400">Süre:</div>
              <div className="text-white font-mono">
                {stats.duration.toFixed(2)}s
              </div>
              <div className="text-gray-400">Hız:</div>
              <div className="font-mono text-emerald-400">
                {formatSize(stats.size / stats.duration)}/s
              </div>
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="mt-6 space-y-4 border-t border-emerald-500/20 pt-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-gray-300 flex items-center justify-between">
                <span>Playback (Direct Stream)</span>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="text-xs transition-colors bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-1 rounded-md border border-emerald-500/30"
                >
                  {downloading ? "Downloading..." : "Test Download Performance"}
                </button>
              </h3>

              {downloadStats && (
                <div className="bg-emerald-500/5 border border-dashed border-emerald-500/20 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-emerald-500/70 uppercase mb-1">
                    Download Stats (Direct)
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs font-mono">
                    <span className="text-gray-500">Duration:</span>
                    <span className="text-white">
                      {downloadStats.duration.toFixed(2)}s
                    </span>
                    <span className="text-gray-500">Speed:</span>
                    <span className="text-emerald-400">
                      {formatSize(downloadStats.size / downloadStats.duration)}
                      /s
                    </span>
                  </div>
                </div>
              )}

              <video
                controls
                width="100%"
                className="rounded-lg border border-emerald-500/50 bg-black"
              >
                <source src={videoUrl} type={file?.type} />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
