import axios from "axios";
import React, { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface TraditionalModeProps {
  initialFilename?: string | null;
  onUploadSuccess?: (filename: string) => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const PARALLEL_CHUNKS = 3;

export const TraditionalMode: React.FC<TraditionalModeProps> = ({
  initialFilename,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const [useChunked, setUseChunked] = useState(false);

  const [stats, setStats] = useState<{ duration: number; size: number } | null>(
    null
  );

  useEffect(() => {
    if (initialFilename) {
      setVideoUrl(
        `http://localhost:3001/api/traditional/video/${encodeURIComponent(
          initialFilename
        )}`
      );
      setStatus("Video loaded from library");
    }
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
      setUploadProgress(0);
    }
  };

  const handleChunkedUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setStatus("Initializing chunked upload...");
    const startTime = performance.now();

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      const initResponse = await axios.post(
        "http://localhost:3001/api/traditional/chunk/init",
        { filename: file.name, totalChunks }
      );
      const { uploadId } = initResponse.data;

      setStatus(`Uploading ${totalChunks} chunks in parallel...`);

      let completedChunks = 0;
      const uploadChunk = async (chunkIndex: number) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("uploadId", uploadId);
        formData.append("chunkIndex", chunkIndex.toString());

        await axios.post(
          "http://localhost:3001/api/traditional/chunk/upload",
          formData
        );

        completedChunks++;
        setUploadProgress(Math.round((completedChunks / totalChunks) * 100));
      };

      for (let i = 0; i < totalChunks; i += PARALLEL_CHUNKS) {
        const batch = [];
        for (let j = i; j < Math.min(i + PARALLEL_CHUNKS, totalChunks); j++) {
          batch.push(uploadChunk(j));
        }
        await Promise.all(batch);
      }

      setStatus("Completing chunked upload...");
      const completeResponse = await axios.post(
        "http://localhost:3001/api/traditional/chunk/complete",
        { uploadId, filename: file.name, totalChunks }
      );

      const endTime = performance.now();
      setStats({
        duration: (endTime - startTime) / 1000,
        size: file.size,
      });

      setStatus("Chunked Upload Complete!");
      if (onUploadSuccess) {
        onUploadSuccess(completeResponse.data.filename);
      }
      setVideoUrl(
        `http://localhost:3001/api/traditional/video/${encodeURIComponent(
          completeResponse.data.filename
        )}`
      );
    } catch (err) {
      console.error(err);
      setStatus("Chunked Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  const handleNormalUpload = async () => {
    if (!file) return;

    setUploading(true);
    setStatus("Uploading to Node.js Server...");
    const startTime = performance.now();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:3001/api/traditional/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const endTime = performance.now();
      setStats({
        duration: (endTime - startTime) / 1000,
        size: file.size,
      });

      setStatus("Upload Complete!");
      if (onUploadSuccess) {
        onUploadSuccess(response.data.filename);
      }
      setVideoUrl(
        `http://localhost:3001/api/traditional/video/${encodeURIComponent(
          response.data.filename
        )}`
      );
    } catch (err) {
      console.error(err);
      setStatus("Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    if (useChunked) {
      handleChunkedUpload();
    } else {
      handleNormalUpload();
    }
  };

  const [downloadStats, setDownloadStats] = useState<{
    duration: number;
    size: number;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleChunkedDownload = async () => {
    if (!file?.name && !initialFilename) return;
    const filename = file?.name || initialFilename!;

    setDownloading(true);
    const startTime = performance.now();

    try {
      const infoRes = await axios.get(
        `http://localhost:3001/api/traditional/chunk/download/${encodeURIComponent(
          filename
        )}`
      );
      const fileSize = infoRes.data.size;

      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      const chunks: ArrayBuffer[] = new Array(totalChunks);

      const downloadChunk = async (chunkIndex: number) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize) - 1;

        const response = await axios.get(
          `http://localhost:3001/api/traditional/chunk/download/${encodeURIComponent(
            filename
          )}?start=${start}&end=${end}`,
          { responseType: "arraybuffer" }
        );
        chunks[chunkIndex] = response.data;
      };

      for (let i = 0; i < totalChunks; i += PARALLEL_CHUNKS) {
        const batch = [];
        for (let j = i; j < Math.min(i + PARALLEL_CHUNKS, totalChunks); j++) {
          batch.push(downloadChunk(j));
        }
        await Promise.all(batch);
      }

      const blob = new Blob(chunks);

      const endTime = performance.now();
      setDownloadStats({
        duration: (endTime - startTime) / 1000,
        size: blob.size,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `chunked-${filename}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Chunked download failed:", err);
      alert("Chunked download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleNormalDownload = async () => {
    if (!videoUrl) return;

    setDownloading(true);
    const startTime = performance.now();

    try {
      const response = await axios.get(videoUrl, {
        responseType: "blob",
      });

      const endTime = performance.now();
      const blob = response.data;

      setDownloadStats({
        duration: (endTime - startTime) / 1000,
        size: blob.size,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `traditional-${file?.name || "video"}`);
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

  const handleDownload = () => {
    if (useChunked) {
      handleChunkedDownload();
    } else {
      handleNormalDownload();
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
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
      <h2 className="text-xl font-semibold mb-4 text-red-400 flex items-center gap-2">
        <span>⚠️</span> Mod A: Traditional Method
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        File is sent to Node.js server and stored on Local Disk (No Object
        Storage). Video playback is also served directly from the server's disk.
        <br />
        <span className="text-xs text-red-500 font-mono mt-1 block">
          Bottleneck: Node.js Network, RAM & Disk I/O
        </span>
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useChunked}
            onChange={(e) => setUseChunked(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500 focus:ring-offset-gray-800"
          />
          <span className="text-sm text-gray-300">
            <span className="font-medium text-red-400">Chunked Mode</span> -
            Parallel upload/download (5MB chunks)
          </span>
        </label>

        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-gray-700 file:text-white
            hover:file:bg-gray-600 cursor-pointer"
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={cn(
            "w-full py-2 px-4 rounded-lg font-medium transition-colors",
            uploading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700 text-white"
          )}
        >
          {uploading
            ? useChunked
              ? "Chunked Uploading..."
              : "Processing..."
            : useChunked
            ? "Upload via Chunked Mode"
            : "Upload via Server"}
        </button>

        {uploading && useChunked && (
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2 overflow-hidden">
            <div
              className="bg-red-400 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {status && (
          <div className="text-sm text-center font-mono text-gray-300 bg-gray-900/50 p-2 rounded">
            {status}
            {uploading && useChunked && uploadProgress > 0
              ? ` (${uploadProgress}%)`
              : ""}
          </div>
        )}

        {stats && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex flex-col gap-1">
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
              Yükleme İstatistikleri {useChunked && "(Chunked)"}
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
              <div className="font-mono text-red-400">
                {formatSize(stats.size / stats.duration)}/s
              </div>
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="mt-6 space-y-4 border-t border-gray-700 pt-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-gray-300 flex items-center justify-between">
                <span>Playback {useChunked ? "(Chunked)" : "(Proxy)"}</span>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="text-xs transition-colors bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1 rounded-md border border-red-500/30"
                >
                  {downloading
                    ? "Downloading..."
                    : `Test ${useChunked ? "Chunked" : "Normal"} Download`}
                </button>
              </h3>

              {downloadStats && (
                <div className="bg-red-500/5 border border-dashed border-red-500/20 p-3 rounded-lg">
                  <div className="text-[10px] font-bold text-red-500/70 uppercase mb-1">
                    Download Stats {useChunked && "(Chunked Parallel)"}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-xs font-mono">
                    <span className="text-gray-500">Duration:</span>
                    <span className="text-white">
                      {downloadStats.duration.toFixed(2)}s
                    </span>
                    <span className="text-gray-500">Speed:</span>
                    <span className="text-red-400">
                      {formatSize(downloadStats.size / downloadStats.duration)}
                      /s
                    </span>
                  </div>
                </div>
              )}

              <video
                controls
                width="100%"
                className="rounded-lg border border-gray-700 bg-black"
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
