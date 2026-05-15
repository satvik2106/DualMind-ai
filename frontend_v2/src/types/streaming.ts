/**
 * Typed SSE event contracts for the DualMind orchestration pipeline.
 *
 * Every event emitted by the backend `/api/chat/stream` endpoint conforms
 * to one of the discriminated-union members below.  The frontend SSE client
 * and Zustand store both rely on these types for end-to-end type safety.
 */

// ---------------------------------------------------------------------------
// Agent / Tool metadata
// ---------------------------------------------------------------------------

export interface PlanStep {
  step: number;
  tool: string;
  purpose: string;
  input?: string;
  depends_on?: number[];
}

export interface PlanPayload {
  pipeline: PlanStep[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Individual SSE event types
// ---------------------------------------------------------------------------

export interface SessionStartedEvent {
  type: 'session_started';
  sessionId: string | null;
  query: string;
}

export interface PlannerStartedEvent {
  type: 'planner_started';
}

export interface PlannerCompletedEvent {
  type: 'planner_completed';
  plan: PlanPayload;
  explanation: string;
}

export interface VerifierStartedEvent {
  type: 'verifier_started';
}

export interface VerifierIterationEvent {
  type: 'verifier_iteration';
  iteration: number;
  score: number;
  approved: boolean;
  issues: number;
}

export interface VerifierCompletedEvent {
  type: 'verifier_completed';
  score: number;
  approved: boolean;
}

export interface ToolStartedEvent {
  type: 'tool_started';
  step: number;
  totalSteps: number;
  tool: string;
  purpose: string;
}

export interface ToolCompletedEvent {
  type: 'tool_completed';
  step: number;
  tool: string;
  status: 'success' | 'error';
  executionTime: number;
  outputPreview: string;
}

export interface SynthesisStartedEvent {
  type: 'synthesis_started';
}

export interface SynthesisCompletedEvent {
  type: 'synthesis_completed';
}

export interface TokenEvent {
  type: 'token';
  content: string;
}

export interface CompletedEvent {
  type: 'completed';
  sessionId: string | null;
  executionTime: number;
  toolsExecuted: number;
  successCount: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface ThoughtEvent {
  type: 'thought';
  content: string;
}

// ---------------------------------------------------------------------------
// Discriminated union of all SSE events
// ---------------------------------------------------------------------------

export type OrchestrationEvent =
  | SessionStartedEvent
  | PlannerStartedEvent
  | PlannerCompletedEvent
  | VerifierStartedEvent
  | VerifierIterationEvent
  | VerifierCompletedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | SynthesisStartedEvent
  | SynthesisCompletedEvent
  | TokenEvent
  | CompletedEvent
  | ErrorEvent
  | ThoughtEvent;

// ---------------------------------------------------------------------------
// Agent lifecycle status (for UI visualisation)
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'active' | 'completed' | 'error';

export interface AgentState {
  name: string;
  label: string;
  status: AgentStatus;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Tool execution record (for the timeline feed)
// ---------------------------------------------------------------------------

export interface ToolRecord {
  step: number;
  tool: string;
  purpose: string;
  status: 'running' | 'success' | 'error';
  executionTime?: number;
  outputPreview?: string;
  startTime?: number;
  endTime?: number;
}
