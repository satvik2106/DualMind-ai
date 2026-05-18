/**
 * SSE client for the DualMind streaming orchestration pipeline.
 *
 * Connects to `/api/chat/stream`, parses incoming events, and dispatches
 * them to the Zustand chat store.  Handles reconnection, timeouts, and
 * graceful error surfaces.
 */

import type { OrchestrationEvent } from '@/types/streaming';
import { useChatStore } from '@/lib/store/chatStore';
import { saveMessageToDB } from '@/lib/api';


// Map backend tool names → agent visualiser names
const TOOL_TO_AGENT: Record<string, string> = {
  wikipedia_search:    'researcher',
  arxiv_summarizer:    'researcher',
  semantic_scholar:    'researcher',
  pubmed_search:       'researcher',
  news_fetcher:        'researcher',
  qa_engine:           'coder',
  data_plotter:        'coder',
  document_writer:     'coder',
  sentiment_analyzer:  'coder',
  pdf_parser:          'researcher',
};

let currentAbortController: AbortController | null = null;

/**
 * Abort/interrupted the active AI generation stream.
 */
export function abortStream(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    
    const store = useChatStore.getState();
    store.setIsStreaming(false);
    store.setStreamStatus('idle');
    store.setActivePhase(null);
    store.setCurrentActiveTool(null);
  }
}

/**
 * Send a chat message and stream the orchestration response.
 *
 * Returns a promise that resolves when the stream is complete or errors.
 */
export async function streamChat(message: string): Promise<void> {
  const store = useChatStore.getState();
  
  // Reset previous telemetry
  store.setTelemetry({ tokensPerSecond: 0, latency: 0, totalTokens: 0 });
  store.setErrorDetail(null);
  store.setStreamStatus('connecting');

  // Assistant placeholder
  const assistantId = store.startAssistantMessage();
  const conversationId = store.activeConversationId;
  
  store.setIsStreaming(true);
  store.resetAgents();
  store.setActivePhase('planning');

  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let tokenCount = 0;
  let retryCount = 0;
  const maxRetries = 2;

  const runStream = async (): Promise<void> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      currentAbortController = new AbortController();
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, conversationId: conversationId || '' }),
        signal: currentAbortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SERVER_ERROR:${response.status}:${errText}`);
      }

      store.setStreamStatus('streaming');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('NO_STREAM_READER');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double-newline (SSE boundary)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          try {
            const event: OrchestrationEvent = JSON.parse(payload);
            
            // Handle Telemetry
            if (event.type === 'token') {
              tokenCount++;
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
                store.setTelemetry({ latency: firstTokenTime - startTime });
              }
              
              // Calculate TPS every 10 tokens to avoid UI flicker
              if (tokenCount % 10 === 0) {
                const elapsed = (Date.now() - (firstTokenTime || startTime)) / 1000;
                store.setTelemetry({ 
                  tokensPerSecond: Number((tokenCount / Math.max(elapsed, 0.1)).toFixed(1)),
                  totalTokens: tokenCount 
                });
              }
            }

            dispatchEvent(assistantId, event);
          } catch {
            // skip malformed payloads
          }
        }
      }

      // Final status check
      const state = useChatStore.getState();
      const msg = state.messages.find(m => m.id === assistantId);
      if (msg && msg.status !== 'complete' && msg.status !== 'error') {
        store.setMessageStatus(assistantId, 'complete');
      }
      
      // PERSISTENCE: Save assistant message to history
      // Re-read conversationId from store — it may have been set AFTER streamChat was called
      const currentConvId = useChatStore.getState().activeConversationId;
      if (currentConvId) {
        const finalMsg = useChatStore.getState().messages.find(m => m.id === assistantId);
        if (finalMsg) {
          await saveMessageToDB(currentConvId, { ...finalMsg, status: 'complete' });
        }
      }
      
      store.setStreamStatus('idle');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        store.setStreamStatus('idle');
        return;
      }

      if (retryCount < maxRetries && !err.message.includes('SERVER_ERROR:4')) {
        retryCount++;
        store.setStreamStatus('reconnecting');
        await new Promise(r => setTimeout(r, 1000 * retryCount));
        return runStream();
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown neural link failure';
      store.setErrorDetail({ 
        code: errorMessage.includes('SERVER_ERROR') ? 'API_FAILURE' : 'CONNECTION_INTERRUPTED',
        message: errorMessage
      });
      
      store.setStreamStatus('error');
      useChatStore.getState().setMessageStatus(assistantId, 'error');
    }
  };

  await runStream();
  useChatStore.getState().setIsStreaming(false);
  useChatStore.getState().setActivePhase(null);
  useChatStore.getState().setCurrentActiveTool(null);
}

// ---------------------------------------------------------------------------
// Event dispatcher — translates SSE events into Zustand mutations
// ---------------------------------------------------------------------------

function dispatchEvent(assistantId: string, event: any): void {
  const s = useChatStore.getState();

  // 1. Add to the unified cognitive timeline for the cinematic visualization
  if (
    event.type !== 'token' && 
    event.type !== 'session_started' && 
    event.type !== 'completed' &&
    event.type !== 'error'
  ) {
    s.addCognitiveEvent({
      type: event.type,
      content: event.content || event.purpose || event.tool || event.agent || '',
      agent: event.agent || TOOL_TO_AGENT[event.tool] || undefined,
      metadata: event,
    });
  }

  // 2. Handle specific state mutations
  switch (event.type) {
    case 'session_started':
      s.setSessionId(event.sessionId);
      break;

    case 'agent_thinking':
      s.setAgentStatus(event.agent || 'planner', 'active', event.content);
      break;

    case 'memory_recall':
      s.setAgentStatus('planner', 'active', event.content);
      break;

    case 'planner_started':
      s.setActivePhase('planning');
      s.setAgentStatus('planner', 'active');
      break;

    case 'planner_completed':
      s.setAgentStatus('planner', 'completed');
      if (event.plan) {
        s.setMessagePlan(assistantId, event.plan);
      }
      break;

    case 'verifier_started':
      s.setActivePhase('verifying');
      s.setAgentStatus('verifier', 'active');
      break;

    case 'verification_critique':
      s.setAgentStatus('verifier', 'active', `Critique: ${event.score}/100`);
      break;

    case 'verifier_completed':
      s.setAgentStatus('verifier', event.approved ? 'completed' : 'error');
      s.setMessageVerifierScore(assistantId, event.score);
      break;

    case 'tool_started': {
      s.setActivePhase('executing');
      s.setCurrentActiveTool(event.tool);
      const agentName = TOOL_TO_AGENT[event.tool] || 'researcher';
      s.setAgentStatus(agentName, 'active', event.purpose);
      s.addToolRecord(assistantId, {
        step: event.step,
        tool: event.tool,
        purpose: event.purpose,
        status: 'running',
        startTime: Date.now(),
      });
      break;
    }

    case 'tool_completed': {
      s.setCurrentActiveTool(null);
      const agentName = TOOL_TO_AGENT[event.tool] || 'researcher';
      s.setAgentStatus(agentName, event.status === 'success' ? 'completed' : 'error');
      s.updateToolRecord(assistantId, event.step, {
        status: event.status,
        executionTime: event.executionTime,
        outputPreview: event.outputPreview,
        endTime: Date.now(),
      });
      break;
    }

    case 'confidence_update':
      // The DAG engine emits this as parallel execution resolves
      s.setAgentStatus('analyst', 'active', `Confidence: ${(event.overall * 100).toFixed(0)}%`);
      break;

    case 'synthesis_started':
      s.setActivePhase('synthesizing');
      s.setAgentStatus('synthesizer', 'active');
      break;

    case 'artifact_generating':
      s.setAgentStatus('synthesizer', 'active', 'Generating layout...');
      break;

    case 'chart_rendering':
      s.setAgentStatus('visualizer', 'active', 'Rendering charts...');
      break;

    case 'artifact_generated':
      // Artifact created on the backend — Auto-open it in the workspace!
      s.setAgentStatus('visualizer', 'completed');
      s.setActiveArtifact(event.artifactId, event.artifactType, event.title);
      break;

    case 'token':
      if (!(window as any)._tokenBuffer) {
        (window as any)._tokenBuffer = '';
        (window as any)._tokenMsgId = assistantId;
        
        const flush = () => {
          const buffer = (window as any)._tokenBuffer;
          const msgId = (window as any)._tokenMsgId;
          if (buffer && msgId) {
            useChatStore.getState().appendToken(msgId, buffer);
            (window as any)._tokenBuffer = '';
          }
          if (useChatStore.getState().isStreaming) {
            requestAnimationFrame(flush);
          }
        };
        requestAnimationFrame(flush);
      }
      (window as any)._tokenBuffer += event.content;
      break;

    case 'synthesis_completed':
      s.setAgentStatus('synthesizer', 'completed');
      break;

    case 'completed':
      s.setMessageStatus(assistantId, 'complete');
      s.setMessageExecutionTime(assistantId, event.executionTime);
      s.setActivePhase(null);
      s.setTelemetry({ 
        totalTokens: useChatStore.getState().telemetry.totalTokens,
        tokensPerSecond: Number((useChatStore.getState().telemetry.totalTokens / Math.max(event.executionTime, 0.1)).toFixed(1))
      });
      break;

    case 'error':
      s.appendToken(assistantId, `\n\n**Error:** ${event.message}`);
      s.setMessageStatus(assistantId, 'error');
      s.setActivePhase(null);
      break;
  }
}
