import React, { type ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 shadow-md">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Dual Mode: Upload Performance PoC
        </h1>
      </header>
      <main className="flex-1 container mx-auto p-6">{children}</main>
      <footer className="bg-gray-800 border-t border-gray-700 py-4 text-center text-sm text-gray-400">
        Demo Application - MinIO & Node.js
      </footer>
    </div>
  );
};
