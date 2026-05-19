/* eslint-disable */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Maximize2, X, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';

export default function ArtifactViewer() {
  const { activeArtifactId, artifactsList, setActiveArtifact, toggleWorkspaceMode } = useChatStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeArtifact = artifactsList.find(a => a.id === activeArtifactId);

  if (!activeArtifact) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-foreground-muted opacity-50 p-8 text-center">
        <Layers className="w-12 h-12 mb-4" />
        <p className="text-lg mb-2">No Active Artifact</p>
        <p className="text-sm max-w-xs">Reports, charts, and intelligence summaries will appear here during orchestration.</p>
      </div>
    );
  }

  const handleDownloadHtml = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${activeArtifactId}/download?format=html`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeArtifact.title}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${activeArtifactId}/download?format=pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeArtifact.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
    }
  };

  const iframeSrc = `${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${activeArtifactId}/view`;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={`flex flex-col bg-background-secondary border-l border-border-glass ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full w-full'}`}
      >
        {/* Artifact Header */}
        <div className="h-14 border-b border-border-glass flex items-center justify-between px-4 bg-background-glass backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            <h3 className="font-semibold text-sm truncate max-w-[200px] md:max-w-md">{activeArtifact.title}</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border-glass bg-glass-overlay text-foreground-muted">
              {activeArtifact.type.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={handleDownloadHtml}
              className="p-2 hover:bg-glass-overlay rounded-lg text-foreground-muted hover:text-foreground transition-colors"
              title="Download HTML"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={handleDownloadPdf}
              className="p-2 hover:bg-glass-overlay rounded-lg text-foreground-muted hover:text-foreground transition-colors"
              title="Download PDF"
            >
              <span className="text-xs font-bold uppercase">PDF</span>
            </button>
            <div className="w-px h-4 bg-foreground-muted/20 mx-1" />
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-glass-overlay rounded-lg text-foreground-muted hover:text-foreground transition-colors"
            >
              <Maximize2 size={16} />
            </button>
            {!isFullscreen && (
              <button 
                onClick={() => toggleWorkspaceMode(false)}
                className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-foreground-muted transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Artifact Tabs (Optional for multiple artifacts) */}
        {artifactsList.length > 1 && (
          <div className="flex items-center px-2 py-1 gap-1 border-b border-border-glass bg-glass-overlay overflow-x-auto scrollbar-none shrink-0">
            {artifactsList.map(a => (
              <button
                key={a.id}
                onClick={() => setActiveArtifact(a.id, a.type, a.title)}
                className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-all ${
                  a.id === activeArtifactId 
                    ? 'bg-foreground text-background shadow-sm' 
                    : 'text-foreground-muted hover:bg-glass-overlay hover:text-foreground'
                }`}
              >
                {a.title.substring(0, 20)}{a.title.length > 20 ? '...' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Artifact Content (Iframe Rendering) */}
        <div className="flex-1 relative bg-white">
          {/* We use an iframe to perfectly sandbox the backend's HTML generation (which includes Tailwind/Chart.js scripts) */}
          <iframe 
            key={activeArtifactId}
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0"
            title="Artifact Viewer"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}


