/**
 * Zustand state management for the DualMind AI OS workspace.
 * Manages messages, artifacts, workspace mode, and realtime cognitive events.
 */

import { create } from 'zustand';
import type { AgentState, PlanPayload, ToolRecord } from '@/types/streaming';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  toolRecords: ToolRecord[];
  plan?: PlanPayload;
  verifierScore?: number;
  executionTime?: number;
}

export interface ArtifactData {
  id: string;
  type: string;
  title: string;
  url?: string; // If rendering via iframe
}

export interface CognitiveEvent {
  id: string;
  timestamp: number;
  type: string;
  content?: string;
  agent?: string;
  metadata?: any;
}

const DEFAULT_AGENTS: AgentState[] = [
  { name: 'planner',     label: 'Planner',     status: 'idle' },
  { name: 'verifier',    label: 'Verifier',    status: 'idle' },
  { name: 'researcher',  label: 'Researcher',  status: 'idle' },
  { name: 'coder',       label: 'Coder',       status: 'idle' },
  { name: 'synthesizer', label: 'Synthesizer', status: 'idle' },
  { name: 'visualizer',  label: 'Visualizer',  status: 'idle' },
];

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ChatStore {
  // --- Workspace State ---
  isWorkspaceMode: boolean;
  activeArtifactId: string | null;
  artifactsList: ArtifactData[];
  
  // --- Cognition State ---
  cognitiveTimeline: CognitiveEvent[];
  
  // --- Chat State ---
  messages: ChatMessage[];
  agents: AgentState[];
  sessionId: string | null;
  activeConversationId: string | null;
  isStreaming: boolean;
  streamStatus: 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'error';
  currentActiveTool: string | null;
  activePhase: string | null;

  // --- Telemetry ---
  telemetry: {
    tokensPerSecond: number;
    latency: number;
    totalTokens: number;
    model: string;
  };
  errorDetail: { code: string; message: string } | null;

  // --- Actions ---
  toggleWorkspaceMode: (open: boolean) => void;
  setActiveArtifact: (id: string | null, type?: string, title?: string) => void;
  addArtifact: (artifact: ArtifactData) => void;
  addCognitiveEvent: (event: Omit<CognitiveEvent, 'id' | 'timestamp'>) => void;
  
  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendToken: (msgId: string, token: string) => void;
  setMessageStatus: (msgId: string, status: ChatMessage['status']) => void;
  setMessagePlan: (msgId: string, plan: PlanPayload) => void;
  setMessageVerifierScore: (msgId: string, score: number) => void;
  setMessageExecutionTime: (msgId: string, time: number) => void;
  addToolRecord: (msgId: string, record: ToolRecord) => void;
  updateToolRecord: (msgId: string, step: number, updates: Partial<ToolRecord>) => void;

  setAgentStatus: (name: string, status: AgentState['status'], detail?: string) => void;
  resetAgents: () => void;

  setSessionId: (id: string | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamStatus: (status: 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'error') => void;
  setCurrentActiveTool: (tool: string | null) => void;
  setActivePhase: (phase: string | null) => void;
  setTelemetry: (updates: Partial<ChatStore['telemetry']>) => void;
  setErrorDetail: (error: { code: string; message: string } | null) => void;
  
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

let _nextId = 0;
const uid = () => `msg_${Date.now()}_${_nextId++}`;
const evtId = () => `evt_${Date.now()}_${_nextId++}`;

export const useChatStore = create<ChatStore>((set) => ({
  isWorkspaceMode: false,
  activeArtifactId: null,
  artifactsList: [],
  cognitiveTimeline: [],
  
  messages: [],
  agents: DEFAULT_AGENTS.map(a => ({ ...a })),
  sessionId: null,
  activeConversationId: null,
  isStreaming: false,
  streamStatus: 'idle',
  currentActiveTool: null,
  activePhase: null,

  telemetry: {
    tokensPerSecond: 0,
    latency: 0,
    totalTokens: 0,
    model: 'Neural Engine v3.1',
  },
  errorDetail: null,

  toggleWorkspaceMode: (open) => set({ isWorkspaceMode: open }),
  
  setActiveArtifact: (id, type, title) => set((s) => {
    if (id && type && title && !s.artifactsList.find(a => a.id === id)) {
      return { 
        activeArtifactId: id, 
        isWorkspaceMode: true,
        artifactsList: [...s.artifactsList, { id, type, title }] 
      };
    }
    return { activeArtifactId: id, isWorkspaceMode: !!id };
  }),

  addArtifact: (artifact) => set((s) => {
    if (s.artifactsList.find(a => a.id === artifact.id)) return s;
    return { artifactsList: [...s.artifactsList, artifact] };
  }),

  addCognitiveEvent: (event) => set((s) => ({
    cognitiveTimeline: [...s.cognitiveTimeline, { ...event, id: evtId(), timestamp: Date.now() }]
  })),

  addUserMessage: (content) => {
    const id = uid();
    set((s) => ({
      messages: [...s.messages, {
        id, role: 'user', content, status: 'complete', toolRecords: [],
      }],
      cognitiveTimeline: [], // Clear timeline on new message
    }));
    return id;
  },

  startAssistantMessage: () => {
    const id = uid();
    set((s) => ({
      messages: [...s.messages, {
        id, role: 'assistant', content: '', status: 'pending', toolRecords: [],
      }],
    }));
    return id;
  },

  appendToken: (msgId, token) =>
    set((s) => ({
      messages: s.messages.map(m =>
        m.id === msgId ? { ...m, content: m.content + token, status: 'streaming' as const } : m,
      ),
    })),

  setMessageStatus: (msgId, status) =>
    set((s) => ({
      messages: s.messages.map(m => (m.id === msgId ? { ...m, status } : m)),
    })),

  setMessagePlan: (msgId, plan) =>
    set((s) => ({
      messages: s.messages.map(m => (m.id === msgId ? { ...m, plan } : m)),
    })),

  setMessageVerifierScore: (msgId, score) =>
    set((s) => ({
      messages: s.messages.map(m => (m.id === msgId ? { ...m, verifierScore: score } : m)),
    })),

  setMessageExecutionTime: (msgId, time) =>
    set((s) => ({
      messages: s.messages.map(m => (m.id === msgId ? { ...m, executionTime: time } : m)),
    })),

  addToolRecord: (msgId, record) =>
    set((s) => ({
      messages: s.messages.map(m =>
        m.id === msgId ? { ...m, toolRecords: [...m.toolRecords, record] } : m,
      ),
    })),

  updateToolRecord: (msgId, step, updates) =>
    set((s) => ({
      messages: s.messages.map(m =>
        m.id === msgId
          ? { ...m, toolRecords: m.toolRecords.map(t => (t.step === step ? { ...t, ...updates } : t)) }
          : m,
      ),
    })),

  setAgentStatus: (name, status, detail) =>
    set((s) => ({
      agents: s.agents.map(a => (a.name === name ? { ...a, status, detail } : a)),
    })),

  resetAgents: () =>
    set(() => ({ agents: DEFAULT_AGENTS.map(a => ({ ...a })) })),

  setSessionId: (id) => set({ sessionId: id }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setStreamStatus: (streamStatus) => set({ streamStatus }),
  setCurrentActiveTool: (tool) => set({ currentActiveTool: tool }),
  setActivePhase: (phase) => set({ activePhase: phase }),
  setTelemetry: (updates) => set((s) => ({ telemetry: { ...s.telemetry, ...updates } })),
  setErrorDetail: (errorDetail) => set({ errorDetail }),
  
  setMessages: (messages) => set({ messages }),
  clearMessages: () =>
    set({
      messages: [],
      sessionId: null,
      activeConversationId: null,
      agents: DEFAULT_AGENTS.map(a => ({ ...a })),
      activePhase: null,
      currentActiveTool: null,
      streamStatus: 'idle',
      cognitiveTimeline: [],
      artifactsList: [],
      activeArtifactId: null,
      isWorkspaceMode: false,
      telemetry: { tokensPerSecond: 0, latency: 0, totalTokens: 0, model: 'Neural Engine v3.1' },
      errorDetail: null,
    }),
}));
