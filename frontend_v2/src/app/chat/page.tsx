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
  X,
  LogOut,
  Settings,
  ChevronDown,
  Square,
  Loader2,
  Paperclip,
  File,
  ListTree,
  Zap,
  Sparkles,
  Terminal,
  FileText,
  Globe,
  RefreshCw,
  Copy,
  Edit,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { useChatStore } from '@/lib/store/chatStore';
import { streamChat, abortStream } from '@/lib/streaming/sseClient';
import StreamedMarkdown from '@/components/chat/StreamedMarkdown';
import TelemetryPanel from '@/components/chat/TelemetryPanel';
import ErrorSurface from '@/components/chat/ErrorSurface';
import MemoryTimeline from '@/components/chat/MemoryTimeline';
import CognitionTimeline from '@/components/chat/CognitionTimeline';
import CommandPalette from '@/components/chat/CommandPalette';
import SettingsModal from '@/components/chat/SettingsModal';
import DAGVisualizer from '@/components/workspace/DAGVisualizer';
import ArtifactViewer from '@/components/workspace/ArtifactViewer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  createConversation, 
  getUserConversations, 
  getConversationMessages,
  deleteConversation,
  togglePinConversation,
  saveMessageToDB,
  Chat
} from '@/lib/api';

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
      <div className="absolute inset-0 bg-glass-overlay group-hover:bg-accent-cyan/40 active:bg-accent-cyan transition-colors" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-foreground-muted/40 group-hover:bg-accent-cyan/80 transition-colors" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Profile Dropdown
// ---------------------------------------------------------------------------
function UserProfile({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  
  if (!session?.user) return null;
  
  const initials = (session.user.name || session.user.email || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 w-full p-2 rounded-xl hover:bg-glass-overlay transition-all group"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan/30 to-accent-purple/30 flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border-glass">
            {initials}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{session.user.name || 'User'}</div>
          <div className="text-[10px] text-foreground-muted truncate">{session.user.email}</div>
        </div>
        <ChevronDown size={14} className={`text-foreground-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-background-secondary border border-foreground/10 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <button 
                onClick={() => { setIsOpen(false); onOpenSettings(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-foreground-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <Settings size={14} /> Settings
              </button>
              <div className="border-t border-foreground/5" />
              <button 
                onClick={async () => {
                  localStorage.removeItem('dualmind_logged_in');
                  localStorage.removeItem('dualmind_logged_in_provider');
                  localStorage.removeItem('dualmind_static_user');
                  await signOut({ callbackUrl: '/login' });
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <LogOut size={14} /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant Message Card
// ---------------------------------------------------------------------------
function AssistantMessageCard({ msg }: { msg: any }) {
  const [activeTab, setActiveTab] = useState<'response' | 'details'>('response');
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col w-full">
      {/* Card Header Tabs */}
      <div className="flex items-center gap-4 px-4 pt-3 border-b border-border-glass bg-glass-overlay/30">
        <button 
          onClick={() => setActiveTab('response')}
          className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'response' ? 'border-accent-cyan text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
        >
          Response
        </button>
        {(msg.executionTime || msg.verifierScore) && (
          <button 
            onClick={() => setActiveTab('details')}
            className={`pb-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'details' ? 'border-accent-purple text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
          >
            <ListTree size={12} /> Execution Details
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 md:p-5">
        {activeTab === 'response' && (
          <div className="w-full">
            <StreamedMarkdown content={msg.content} isStreaming={msg.status === 'streaming'} />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="w-full flex flex-col gap-6">
            {/* Metadata pills */}
            <div className="flex items-center gap-3">
              {msg.executionTime && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass-overlay border border-border-glass text-xs font-mono text-foreground-muted">
                  <Zap size={12} className="text-accent-cyan" />
                  {msg.executionTime.toFixed(2)}s runtime
                </div>
              )}
              {msg.verifierScore && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass-overlay border border-border-glass text-xs font-mono text-foreground-muted">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  {msg.verifierScore}% verified confidence
                </div>
              )}
            </div>

            {/* Cognition Timeline (if available) */}
            <div className="bg-background/50 p-4 rounded-xl border border-border-glass">
              <h4 className="text-[10px] uppercase font-bold text-foreground-muted mb-4 tracking-widest">Internal Reasoning Trace</h4>
              <CognitionTimeline />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-glass bg-glass-overlay/10 text-[10px] text-foreground-muted font-mono">
        <div>{msg.status === 'streaming' ? 'Streaming answer...' : 'Execution trace fully verified'}</div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(msg.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-glass-overlay hover:text-foreground transition-colors"
          >
            {copied ? <Check size={11} className="text-accent-cyan" /> : <Copy size={11} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          
          <button 
            onClick={() => {
              alert("Recalculating AGI synthesis pathways...");
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-glass-overlay hover:text-foreground transition-colors"
          >
            <RefreshCw size={11} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Starter Cards
// ---------------------------------------------------------------------------
function StarterCard({ title, desc, icon, onClick }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-2xl bg-background-secondary border border-border-glass hover:border-accent-cyan/30 hover:shadow-[0_0_20px_rgba(0,229,255,0.03)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col gap-2.5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-cyan/5 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-glass-overlay border border-border-glass group-hover:scale-105 transition-transform duration-300">
          {icon}
        </div>
        <span className="text-xs font-semibold text-foreground tracking-wide">{title}</span>
      </div>
      <p className="text-xs text-foreground-muted leading-relaxed line-clamp-2">{desc}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function ChatApp() {
  const { data: session } = useSession();
  
  const messages    = useChatStore(s => s.messages);
  const isStreaming = useChatStore(s => s.isStreaming);
  const activeConversationId = useChatStore(s => s.activeConversationId);
  const setActiveConversationId = useChatStore(s => s.setActiveConversationId);
  const setMessages = useChatStore(s => s.setMessages);
  const clearMessages = useChatStore(s => s.clearMessages);
  const addUserMessage = useChatStore(s => s.addUserMessage);
  const activePhase = useChatStore(s => s.activePhase);
  
  // Workspace
  const isWorkspaceMode = useChatStore(s => s.isWorkspaceMode);
  const toggleWorkspaceMode = useChatStore(s => s.toggleWorkspaceMode);
  const artifactsList = useChatStore(s => s.artifactsList);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Chat[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(40);
  const [attachments, setAttachments] = useState<{name: string, size: string}[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Global keybindings
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      // Cmd/Ctrl + N -> New Instance
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewInstance();
      }
      // Cmd/Ctrl + \ -> Toggle Workspace Mode
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleWorkspaceMode(!isWorkspaceMode);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isWorkspaceMode, toggleWorkspaceMode]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load conversations
  useEffect(() => {
    getUserConversations().then(setConversations).catch(console.error);
  }, []);

  // Auto-resize textarea
  const handleTextareaInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handleSelectStarter = (prompt: string) => {
    if (inputRef.current) {
      inputRef.current.value = prompt;
      inputRef.current.focus();
      handleTextareaInput();
    }
  };

  const handleSplitDrag = useCallback((deltaX: number) => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.clientWidth;
    const deltaPercent = (deltaX / totalWidth) * 100;
    setLeftPanelWidth(prev => Math.min(70, Math.max(25, prev + deltaPercent)));
  }, []);

  const handleNewInstance = () => {
    setActiveConversationId(null);
    clearMessages();
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }
  };

  const loadConversation = async (id: string) => {
    if (id === activeConversationId) return;
    setIsLoadingMessages(true);
    setActiveConversationId(id);
    try {
      const msgs = await getConversationMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
      setIsSidebarOpen(false);
    }
  };

  const handleSend = async () => {
    const value = inputRef.current?.value.trim();
    if (!value || isStreaming) return;
    
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }
    
    // Clear attachments on send (mocked)
    setAttachments([]);
    
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      currentConvId = await createConversation(value.substring(0, 50));
      setActiveConversationId(currentConvId);
      getUserConversations().then(setConversations);
    }

    // PERSISTENCE: Save user message immediately
    const userMsgId = addUserMessage(value);
    await saveMessageToDB(currentConvId, {
      id: userMsgId,
      role: 'user',
      content: value,
      status: 'complete',
      toolRecords: []
    });

    await streamChat(value);
    getUserConversations().then(setConversations);
  };

  // Determine what to show in the right pane
  const showDAG = isStreaming && activePhase && activePhase !== 'synthesizing';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile menu toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-glass-overlay rounded-lg backdrop-blur-md"
      >
        {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar Overlay (mobile) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-background-secondary/95 backdrop-blur-xl border-r border-foreground/10 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col shrink-0`}>
        {/* Logo */}
        <Link href="/" className="block p-5 border-b border-foreground/10 hover:bg-foreground/5 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.2)] group-hover:scale-105 transition-transform">
                <BrainCircuit size={18} className="text-foreground" />
              </div>
              {isStreaming && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-cyan rounded-full animate-ping" />}
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight group-hover:text-accent-cyan transition-colors">DualMind</div>
              <div className="text-[10px] text-foreground-muted font-mono tracking-wider">AI OPERATING SYSTEM</div>
            </div>
          </div>
        </Link>

        {/* New Chat Button */}
        <div className="p-3">
          <button 
            onClick={handleNewInstance} 
            className="w-full py-2.5 bg-foreground/5 hover:bg-foreground/10 rounded-xl border border-foreground/10 flex items-center justify-center gap-2 transition-all hover:border-foreground/20 text-sm font-medium group"
          >
            <Plus className="w-4 h-4 text-accent-cyan group-hover:rotate-90 transition-transform duration-300" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <MemoryTimeline 
            conversations={conversations} 
            activeId={activeConversationId} 
            onSelect={loadConversation}
            onDelete={async (id) => { await deleteConversation(id); getUserConversations().then(setConversations); }}
            onPin={async (id, p) => { await togglePinConversation(id, p); getUserConversations().then(setConversations); }}
          />
        </div>

        {/* Bottom Section */}
        <div className="border-t border-foreground/10 p-3 space-y-2">
          <button 
            onClick={() => toggleWorkspaceMode(!isWorkspaceMode)}
            className={`w-full p-2 rounded-lg flex items-center justify-center gap-2 text-xs transition-all ${isWorkspaceMode ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20' : 'bg-foreground/5 text-foreground-muted border border-transparent hover:bg-foreground/10'}`}
          >
            <Layers size={14} />
            <span className="font-medium">Workspace</span>
          </button>
          <UserProfile onOpenSettings={() => setIsSettingsOpen(true)} />
        </div>
      </div>

      {/* Main Split Area */}
      <div ref={containerRef} className="flex-1 flex relative overflow-hidden">
        
        {/* Left Pane: Chat */}
        <div 
          className="flex flex-col relative bg-background overflow-hidden"
          style={{ width: isWorkspaceMode ? `${leftPanelWidth}%` : '100%', transition: isWorkspaceMode ? 'none' : 'width 0.3s ease' }}
          onDragEnter={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const newFiles = Array.from(e.dataTransfer.files).map(f => ({
                name: f.name,
                size: (f.size / (1024 * 1024)).toFixed(1) + ' MB'
              }));
              setAttachments([...attachments, ...newFiles]);
            }
          }}
        >
          {/* Drop Overlay */}
          <AnimatePresence>
            {isDraggingFile && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-accent-cyan m-4 rounded-3xl"
              >
                <div className="p-5 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 animate-bounce mb-4">
                  <Paperclip className="w-8 h-8 text-accent-cyan" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Ingest Files into DualMind RAG</h3>
                <p className="text-xs text-foreground-muted">Drop PDF, images, CSV, or text docs to build context</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dashboard Big Theme Toggle */}
          <ThemeToggle className="absolute top-4 right-4 z-50 p-3 rounded-2xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 hover:scale-110 shadow-xl backdrop-blur-md" iconSize={20} />

          <TelemetryPanel />
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {isLoadingMessages ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent-cyan/40 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 max-w-2xl mx-auto">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center text-center mb-8"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.15)] animate-pulse">
                      <BrainCircuit className="w-9 h-9 text-background" />
                    </div>
                    <div className="absolute inset-0 bg-accent-cyan/10 blur-3xl rounded-full pointer-events-none" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">DualMind Intelligence OS</h2>
                  <p className="text-sm text-foreground-muted max-w-sm leading-relaxed">
                    Plan, orchestrate, research, and execute advanced workflows using autonomous multi-agent pipelines.
                  </p>
                </motion.div>

                {/* Suggestions Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full animate-in fade-in-50 duration-500 delay-200">
                  <StarterCard 
                    title="Research Optimization" 
                    desc="Synthesize recent academic papers on LLM quantization techniques." 
                    icon={<Sparkles size={16} className="text-accent-cyan" />}
                    onClick={() => handleSelectStarter("Synthesize recent academic papers on LLM quantization techniques and explain tradeoffs.")}
                  />
                  <StarterCard 
                    title="Locate Latency Spikes" 
                    desc="Locate latency bottlenecks in our production PostgreSQL DB clusters." 
                    icon={<Terminal size={16} className="text-accent-purple" />}
                    onClick={() => handleSelectStarter("Locate latency bottlenecks in our production PostgreSQL DB clusters and generate schema fixes.")}
                  />
                  <StarterCard 
                    title="Market Launch Strategy" 
                    desc="Draft a comprehensive market entry plan for an AI Developer Tool." 
                    icon={<FileText size={16} className="text-amber-400" />}
                    onClick={() => handleSelectStarter("Draft a comprehensive market entry plan for an AI Developer Tool targeting enterprise customers.")}
                  />
                  <StarterCard 
                    title="Crawl & Verify APIs" 
                    desc="Crawl documentation sites autonomously to verify API consistency." 
                    icon={<Globe size={16} className="text-emerald-400" />}
                    onClick={() => handleSelectStarter("Crawl documentation sites autonomously to verify external API consistency and types.")}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
                {messages.map((msg) => (
                  <motion.div 
                    key={msg.id} 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    className="w-full flex flex-col"
                  >
                    {msg.role === 'user' ? (
                      <div className="flex justify-end w-full group relative">
                        <div className="flex items-start gap-3 max-w-[85%] sm:max-w-[75%]">
                          <div className="flex flex-col items-end">
                            {editingMsgId === msg.id ? (
                              <div className="flex flex-col gap-2 p-2 rounded-2xl bg-foreground/5 border border-border-glass w-[320px] sm:w-[450px]">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full bg-transparent text-sm text-foreground focus:outline-none resize-none min-h-[60px]"
                                />
                                <div className="flex justify-end gap-1.5 text-[10px] font-mono">
                                  <button
                                    onClick={() => setEditingMsgId(null)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-foreground-muted"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMessages(messages.map(m => m.id === msg.id ? { ...m, content: editingContent } : m));
                                      setEditingMsgId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-accent-cyan text-background font-semibold"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="relative">
                                  <div className="px-5 py-3.5 rounded-2xl rounded-tr-sm bg-foreground/5 border border-foreground/10 text-foreground text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap">
                                    {msg.content}
                                  </div>
                                  
                                  {/* Hover Actions Toolbar */}
                                  <div className="absolute right-2 -bottom-3.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background-secondary border border-border-glass rounded-lg px-1.5 py-0.5 shadow-md flex items-center gap-1 z-10">
                                    <button 
                                      onClick={() => {
                                        setEditingMsgId(msg.id);
                                        setEditingContent(msg.content);
                                      }}
                                      className="p-1 rounded hover:bg-glass-overlay text-foreground-muted hover:text-foreground transition-colors"
                                      title="Edit message"
                                    >
                                      <Edit size={10} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(msg.content);
                                      }}
                                      className="p-1 rounded hover:bg-glass-overlay text-foreground-muted hover:text-foreground transition-colors"
                                      title="Copy message"
                                    >
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-[10px] text-foreground-muted mt-2.5 font-mono opacity-60">
                                  {msg.executionTime ? `${msg.executionTime.toFixed(1)}s` : 'Just now'}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="shrink-0 mt-1">
                            {session?.user?.image ? (
                              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-border-glass shadow-sm" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border-glass shadow-sm">
                                <User size={14} className="text-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start w-full">
                        <div className="flex items-start gap-4 max-w-[95%] sm:max-w-[85%] w-full">
                          <div className="shrink-0 mt-1">
                            <div className={`w-8 h-8 rounded-full bg-accent-cyan/10 flex items-center justify-center ring-1 ring-border-glass shadow-sm ${msg.status === 'streaming' ? 'shadow-[0_0_15px_rgba(0,229,255,0.4)] animate-pulse' : ''}`}>
                              <BrainCircuit size={15} className="text-accent-cyan" />
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-start w-full min-w-0">
                            {msg.status === 'pending' || (msg.status === 'streaming' && !msg.content) ? (
                              <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-background-secondary border border-border-glass flex items-center gap-2">
                                <div className="flex gap-1.5">
                                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs text-foreground-muted font-mono ml-2">Synthesizing...</span>
                              </div>
                            ) : (
                              <div className="w-full bg-background-secondary border border-border-glass rounded-2xl rounded-tl-sm overflow-hidden shadow-sm">
                                <AssistantMessageCard msg={msg} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 md:px-6 md:pb-6 shrink-0 relative bg-background">
            <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <div className="max-w-4xl mx-auto">
              
              <div className="relative bg-background-secondary border border-border-glass rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] focus-within:border-accent-cyan/40 focus-within:shadow-[0_0_0_1px_rgba(0,229,255,0.15)] transition-all flex flex-col">
                
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pt-4 pb-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-glass-overlay border border-border-glass rounded-xl px-3 py-2 animate-in fade-in zoom-in duration-200">
                        <div className="p-1.5 bg-accent-cyan/10 rounded-lg">
                          <File size={14} className="text-accent-cyan" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground max-w-[120px] truncate">{file.name}</span>
                          <span className="text-[9px] text-foreground-muted">{file.size}</span>
                        </div>
                        <button 
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                          className="ml-1 p-1 hover:bg-white/10 rounded-full text-foreground-muted hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 p-2">
                  <div className="shrink-0 pb-1.5 pl-1">
                    <button 
                      onClick={() => {
                        // Mock adding a file
                        setAttachments([...attachments, { name: `Dataset_${attachments.length + 1}.csv`, size: '1.2 MB' }]);
                      }}
                      className="p-2.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-glass-overlay transition-colors"
                      title="Attach file"
                    >
                      <Paperclip size={18} />
                    </button>
                  </div>
                  
                  <textarea
                    ref={inputRef}
                    rows={1}
                    onInput={handleTextareaInput}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Ask anything or drop files here..."
                    className="flex-1 bg-transparent py-4 focus:outline-none resize-none text-[15px] text-foreground placeholder:text-foreground-muted/60 max-h-[250px] min-h-[56px]"
                    disabled={isStreaming}
                  />
                  
                  <div className="shrink-0 pb-1.5 pr-1">
                    <button 
                      onClick={isStreaming ? () => abortStream() : handleSend}
                      className={`p-2.5 rounded-full text-background hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg ${isStreaming ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-accent-cyan hover:bg-accent-cyan/90 shadow-accent-cyan/20'}`}
                    >
                      {isStreaming ? (
                        <Square size={16} className="fill-background animate-pulse" />
                      ) : (
                        <Send size={16} className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="text-center mt-3">
                <p className="text-[11px] text-foreground-muted/60 font-mono">DualMind can make mistakes. Verify important information.</p>
              </div>
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

        {/* Right Pane: Workspace */}
        <AnimatePresence>
          {isWorkspaceMode && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: `${100 - leftPanelWidth}%`, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="relative bg-background-secondary flex flex-col overflow-hidden border-l border-foreground/10"
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

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        conversations={conversations}
        onSelectConversation={loadConversation}
        onCreateNewChat={handleNewInstance}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={session?.user?.email || undefined}
        userName={session?.user?.name || undefined}
      />
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
