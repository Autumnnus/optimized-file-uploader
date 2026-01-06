import { useState } from "react";
import { Layout } from "./components/Layout";
import { OptimizedMode } from "./components/OptimizedMode";
import { TraditionalMode } from "./components/TraditionalMode";
import "./index.css";
import { cn } from "./lib/utils";

function App() {
  const [activeTab, setActiveTab] = useState<"A" | "B">("A");

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setActiveTab("A")}
              className={cn(
                "px-6 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === "A"
                  ? "bg-red-500/10 text-red-400 shadow-sm ring-1 ring-red-500/50"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Traditional Mode
            </button>
            <button
              onClick={() => setActiveTab("B")}
              className={cn(
                "px-6 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === "B"
                  ? "bg-emerald-500/10 text-emerald-400 shadow-sm ring-1 ring-emerald-500/50"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Optimized Mode
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Mobile view: Stacked. Desktop: Side-by-side comparison if we wanted, but Tabs requested */}
          {/* The user requested Tabs OR two separate sections. I will show both if screen is wide enough, 
               or just switch content based on tab if they prefer valid "dual mode" feeling. 
               Let's respect the "Tabs" UI pattern but maybe show them side-by-side for comparison if user wants to race them?
               
               User requirement: "Ana sayfada iki sekme (Tab) veya iki ayrı bölüm olsun"
               I'll use the activeTab state to switch views for specialized focus.
           */}

          <div
            className={cn(
              "transition-opacity duration-300 w-full",
              activeTab === "A"
                ? "block"
                : "hidden md:block md:opacity-50 md:pointer-events-none"
            )}
          >
            <TraditionalMode />
          </div>

          <div
            className={cn(
              "transition-opacity duration-300 w-full",
              activeTab === "B"
                ? "block"
                : "hidden md:block md:opacity-50 md:pointer-events-none"
            )}
          >
            <OptimizedMode />
          </div>

          {/* 
             Actually, a better UX for comparison is to show just one at a time fully interactive, 
             or both side-by-side. 
             Let's just show the active one to be clean, as per standard Tab behavior.
           */}
        </div>

        {/* Overriding the above grid for a simpler Tab View as requested */}
        <div className="mt-4">
          {activeTab === "A" ? <TraditionalMode /> : <OptimizedMode />}
        </div>
      </div>
    </Layout>
  );
}

export default App;
