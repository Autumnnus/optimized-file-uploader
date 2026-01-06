import axios from "axios";
import React, { useEffect, useState } from "react";

interface Video {
  name: string;
  size: number;
}

interface VideoListProps {
  onSelect: (filename: string) => void;
  selectedFilename: string | null;
}

export const VideoList: React.FC<VideoListProps> = ({
  onSelect,
  selectedFilename,
}) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:3001/api/videos");
      setVideos(response.data);
    } catch (err) {
      console.error("Failed to fetch videos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [selectedFilename]);

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      await axios.delete(
        `http://localhost:3001/api/videos/${encodeURIComponent(filename)}`
      );
      if (selectedFilename === filename) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSelect(null as any);
      }
      fetchVideos();
    } catch (err) {
      console.error("Delete failed", err);
      alert("Delete failed");
    }
  };

  if (loading)
    return (
      <div className="text-gray-400 text-sm animate-pulse">
        Loading library...
      </div>
    );

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Video Library
        </h3>
        <button
          onClick={fetchVideos}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-gray-500 text-sm italic bg-gray-900/30 p-4 rounded-lg border border-dashed border-gray-700">
          No videos uploaded yet. Upload your first video to see it here!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {videos.map((video) => (
            <button
              key={video.name}
              onClick={() => onSelect(video.name)}
              className={`p-3 rounded-lg border text-left transition-all group relative ${
                selectedFilename === video.name
                  ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50"
                  : "bg-gray-800/50 border-gray-700 hover:border-gray-500"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div
                  className="text-sm font-medium text-white truncate flex-1"
                  title={video.name}
                >
                  {video.name}
                </div>
                <button
                  onClick={(e) => handleDelete(e, video.name)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                {(video.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
