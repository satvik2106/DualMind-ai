'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  BrainCircuit, 
  User, 
  Plus, 
  Layers,
  Menu,
  X
} from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';
import { streamChat } from '@/lib/streaming/sseClient';
import StreamedMarkdown from '@/components/chat/StreamedMarkdown';
import TelemetryPanel from '@/components/chat/TelemetryPanel';
import ErrorSurface from '@/components/chat/ErrorSurface';
import MemoryTimeline from '@/components/chat/MemoryTimeline';
import CognitionTimeline from '@/components/chat/CognitionTimeline';
import DAGVisualizer from '@/components/workspace/DAGVisualizer';
import ArtifactViewer from '@/components/workspace/ArtifactViewer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/lib/firebase/auth';
import { 
  createConversation, 
  getUserConversations, 
  getConversationMessages,
  deleteConversation,
  togglePinConversation,
  Conversation
} from '@/lib/firebase/firestore';

// ---------------------------------------------------------------------------
// Draggable Split Handle
// ---------------------------------------------------------------------------
function SplitHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1.5 cursor-col-resize flex-shrink-0 relative group z-30"
    >
      <div className="absolute inset-0 bg-white/5 group-hover:bg-accent-cyan/40 active:bg-accent-cyan transition-colors" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-accent-cyan/80 transition-colors" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function ChatApp() {
  const { signOut } = useAuth();
  const activeUser = { uid: 'dualmind_global_user', email: 'anonymous@dualmind.ai' };
  
  const messages    = useChatStore(s => s.messages);
  const isStreaming = useChatStore(s => s.isStreaming);
  const activeConversationId = useChatStore(s => s.activeConversationId);
  const setActiveConversationId = useChatStore(s => s.setActiveConversationId);
  const setMessages = useChatStore(s => s.setMessages);
  const clearMessages = useChatStore(s => s.clearMessages);
  const activePhase = useChatStore(s => s.activePhase);
  
  // Workspace
  const isWorkspaceMode = useChatStore(s => s.isWorkspaceMode);
  const toggleWorkspaceMode = useChatStore(s => s.toggleWorkspaceMode);
  const artifactsList = useChatStore(s => s.artifactsList);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // percentage
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load conversations
  useEffect(() => {
    getUserConversations(activeUser.uid).then(setConversations);
  }, []);

  const handleSplitDrag = useCallback((deltaX: number) => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.clientWidth;
    const deltaPercent = (deltaX / totalWidth) * 100;
    setLeftPanelWidth(prev => Math.min(70, Math.max(25, prev + deltaPercent)));
  }, []);

  const handleNewInstance = () => {
    setActiveConversationId(null);
    clearMessages();
  };

  const loadConversation = async (id: string) => {
    setActiveConversationId(id);
    const msgs = await getConversationMessages(id);
    setMessages(msgs);
    setIsSidebarOpen(false);
  };

  const handleSend = async () => {
    const value = inputRef.current?.value.trim();
    if (!value || isStreaming) return;
    
    if (inputRef.current) inputRef.current.value = '';
    
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      currentConvId = await createConversation(activeUser.uid, value.substring(0, 30));
      setActiveConversationId(currentConvId);
      getUserConversations(activeUser.uid).then(setConversations);
    }

    await streamChat(value);
    getUserConversations(activeUser.uid).then(setConversations);
  };

  // Determine what to show in the right pane
  const showDAG = isStreaming && activePhase && activePhase !== 'synthesizing';
  const showArtifact = !showDAG && (artifactsList.length > 0 || !isStreaming);

  return (
    <div className="flex h-screen bg-[#050B14] text-white overflow-hidden">
      {/* Mobile menu toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white/10 rounded-lg backdrop-blur-md"
      >
        {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0A0F1C] border-r border-white/5 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col shrink-0`}>
        <div className="p-6 border-b border-white/5 font-bold text-xl flex items-center gap-3">
          <div className="relative">
            <BrainCircuit className="text-accent-cyan" />
            {isStreaming && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-cyan rounded-full animate-ping" />}
          </div>
          DualMind OS
        </div>
        <div className="p-4">
          <button onClick={handleNewInstance} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-all hover:border-white/10">
            <Plus className="w-4 h-4 text-accent-cyan" /> New Cycle
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <MemoryTimeline 
            conversations={conversations} 
            activeId={activeConversationId} 
            onSelect={loadConversation}
            onDelete={async (id) => { await deleteConversation(id); getUserConversations(activeUser.uid).then(setConversations); }}
            onPin={async (id, p) => { await togglePinConversation(id, p); getUserConversations(activeUser.uid).then(setConversations); }}
          />
        </div>
        <div className="p-4 border-t border-white/5 text-xs text-foreground-muted flex justify-between items-center">
          <span className="font-mono tracking-wider">v3.1</span>
          <button 
            onClick={() => toggleWorkspaceMode(!isWorkspaceMode)}
            className={`p-1.5 rounded-md flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold transition-all ${isWorkspaceMode ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30' : 'bg-white/5 text-foreground-muted border border-white/5 hover:bg-white/10'}`}
            title="Toggle Workspace Panel"
          >
            <Layers size={12} /> Workspace
          </button>
        </div>
      </div>

      {/* Main Split Area */}
      <div ref={containerRef} className="flex-1 flex relative overflow-hidden">
        
        {/* Left Pane: Chat */}
        <div 
          className="flex flex-col relative bg-[#050B14] overflow-hidden"
          style={{ width: isWorkspaceMode ? `${leftPanelWidth}%` : '100%', transition: isWorkspaceMode ? 'none' : 'width 0.3s ease' }}
        >
          <TelemetryPanel />
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-none">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                <div className="relative">
                  <BrainCircuit className="w-20 h-20 text-accent-cyan/40" />
                  <div className="absolute inset-0 bg-accent-cyan/10 blur-3xl rounded-full" />
                </div>
                <p className="font-mono uppercase tracking-[0.3em] text-xs text-white/40">Autonomous Intelligence Ready</p>
                <p className="text-[10px] text-white/20 max-w-xs text-center">Issue a directive to engage the cognitive orchestration engine.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="max-w-4xl mx-auto">
                <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                    msg.role === 'user' 
                      ? 'bg-accent-purple/20 text-accent-purple' 
                      : `bg-accent-cyan/20 text-accent-cyan ${msg.status === 'streaming' ? 'shadow-[0_0_20px_rgba(45,212,191,0.3)] animate-pulse' : 'shadow-[0_0_10px_rgba(45,212,191,0.15)]'}`
                  }`}>
                    {msg.role === 'user' ? <User size={16} /> : <BrainCircuit size={16} />}
                  </div>
                  <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className="prose prose-invert max-w-none">
                      {msg.role === 'assistant' ? (
                        <StreamedMarkdown content={msg.content} isStreaming={msg.status === 'streaming'} />
                      ) : (
                        <p className="bg-white/5 border border-white/10 p-4 rounded-2xl inline-block text-left text-base">
                          {msg.content}
                        </p>
                      )}
                    </div>
                    {/* Execution time badge */}
                    {msg.executionTime && msg.status === 'complete' && (
                      <div className="mt-2 text-[10px] text-foreground-muted font-mono">
                        Completed in {msg.executionTime.toFixed(1)}s
                        {msg.verifierScore ? ` · Confidence: ${msg.verifierScore}/100` : ''}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Live Cognition Timeline — only on the active streaming message */}
                {msg.role === 'assistant' && (msg.status === 'streaming' || msg.status === 'pending') && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-6 ml-12">
                    <CognitionTimeline />
                  </motion.div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 shrink-0 relative">
            <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-[#050B14] to-transparent pointer-events-none" />
            <div className="max-w-4xl mx-auto relative group">
              <textarea
                ref={inputRef}
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Command the intelligence..."
                className="w-full bg-[#0F172A] border border-white/10 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 transition-all resize-none shadow-2xl text-sm"
                disabled={isStreaming}
              />
              <button 
                onClick={handleSend}
                disabled={isStreaming}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-accent-cyan text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Draggable Resize Handle */}
        <AnimatePresence>
          {isWorkspaceMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SplitHandle onDrag={handleSplitDrag} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Pane: Workspace (DAG / Artifacts) */}
        <AnimatePresence>
          {isWorkspaceMode && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: `${100 - leftPanelWidth}%`, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="relative bg-[#0A0F1C] flex flex-col overflow-hidden border-l border-white/5"
            >
              {showDAG ? (
                <div className="flex-1 overflow-y-auto p-4 scrollbar-none flex flex-col relative">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.03),transparent_70%)] pointer-events-none" />
                  <DAGVisualizer />
                </div>
              ) : (
                <ArtifactViewer />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ErrorSurface />
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatApp />
    </AuthGuard>
  );
}
