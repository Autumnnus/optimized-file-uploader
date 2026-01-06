import { useState } from "react";
import { Layout } from "./components/Layout";
import { OptimizedMode } from "./components/OptimizedMode";
import { TraditionalMode } from "./components/TraditionalMode";
import { VideoList } from "./components/VideoList";
import "./index.css";

function App() {
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12">
        <VideoList
          selectedFilename={selectedFilename}
          onSelect={setSelectedFilename}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <TraditionalMode
            initialFilename={selectedFilename}
            onUploadSuccess={setSelectedFilename}
          />
          <OptimizedMode
            initialFilename={selectedFilename}
            onUploadSuccess={setSelectedFilename}
          />
        </div>
      </div>
    </Layout>
  );
}

export default App;
