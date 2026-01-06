import axios from "axios";
import React, { useState } from "react";
import { cn } from "../lib/utils";

export const TraditionalMode: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const [stats, setStats] = useState<{ duration: number; size: number } | null>(
    null
  );

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
    setStatus("Uploading to Node.js Server...");
    const startTime = performance.now();

    // Traditional: Form Data -> Node.js -> MinIO
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
      // URL points to Node.js proxy endpoint
      setVideoUrl(
        `http://localhost:3001/api/traditional/video/${response.data.filename}`
      );
    } catch (err) {
      console.error(err);
      setStatus("Upload Failed");
    } finally {
      setUploading(false);
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
        File is sent to Node.js server first, then buffered/piped to MinIO.
        Video playback is also proxied through Node.js.
        <br />
        <span className="text-xs text-red-500 font-mono mt-1 block">
          Bottleneck: Node.js Network & RAM
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
          {uploading ? "Processing..." : "Upload via Server"}
        </button>

        {status && (
          <div className="text-sm text-center font-mono text-gray-300 bg-gray-900/50 p-2 rounded">
            {status}
          </div>
        )}

        {stats && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex flex-col gap-1">
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
              İstatistikler
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">Dosya Boyutu:</div>
              <div className="text-white font-mono">
                {formatSize(stats.size)}
              </div>
              <div className="text-gray-400">Süre:</div>
              <div className="text-white font-mono">
                {stats.duration.toFixed(2)}s
              </div>
              <div className="text-gray-400">Hız:</div>
              <div className="text-white font-mono">
                {formatSize(stats.size / stats.duration)}/s
              </div>
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-gray-300">
              Playback (Proxy Stream)
            </h3>
            <video
              controls
              width="100%"
              className="rounded-lg border border-gray-700 bg-black"
            >
              <source src={videoUrl} type={file?.type} />
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </div>
    </div>
  );
};
