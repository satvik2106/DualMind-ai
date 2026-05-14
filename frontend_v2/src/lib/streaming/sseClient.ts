/**
 * SSE client for the DualMind streaming orchestration pipeline.
 *
 * Connects to `/api/chat/stream`, parses incoming events, and dispatches
 * them to the Zustand chat store.  Handles reconnection, timeouts, and
 * graceful error surfaces.
 */

import type { OrchestrationEvent } from '@/types/streaming';
import { useChatStore } from '@/lib/store/chatStore';
import { auth } from '@/lib/firebase/config';

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

  // Optimistic UI: add user message, prepare assistant placeholder
  store.addUserMessage(message);
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
      const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, conversationId: conversationId || '' }),
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
      const msg = useChatStore.getState().messages.find(m => m.id === assistantId);
      if (msg && msg.status !== 'complete' && msg.status !== 'error') {
        store.setMessageStatus(assistantId, 'complete');
      }
      store.setStreamStatus('idle');

    } catch (err: any) {
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

function dispatchEvent(assistantId: string, event: OrchestrationEvent): void {
  const s = useChatStore.getState();

  switch (event.type) {
    case 'session_started':
      s.setSessionId(event.sessionId);
      break;

    case 'planner_started':
      s.setActivePhase('planning');
      s.setAgentStatus('planner', 'active');
      break;

    case 'planner_completed':
      s.setAgentStatus('planner', 'completed');
      s.setMessagePlan(assistantId, event.plan);
      break;

    case 'verifier_started':
      s.setActivePhase('verifying');
      s.setAgentStatus('verifier', 'active');
      break;

    case 'verifier_iteration':
      s.setAgentStatus('verifier', 'active', `Score: ${event.score}/100`);
      break;

    case 'verifier_completed':
      s.setAgentStatus('verifier', event.approved ? 'completed' : 'error');
      s.setMessageVerifierScore(assistantId, event.score);
      break;

    case 'tool_started': {
      s.setActivePhase('executing');
      s.setCurrentActiveTool(event.tool);
      // Activate the matching agent
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

    case 'synthesis_started':
      s.setActivePhase('synthesizing');
      s.setAgentStatus('synthesizer', 'active');
      break;

    case 'thought':
      // Immediately show a thought block or update status
      s.setAgentStatus('planner', 'active', event.content);
      break;

    case 'token':
      // Token Batching Optimization
      // We collect tokens in a local buffer and flush them using RequestAnimationFrame
      // to ensure smooth rendering and zero UI freezing.
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
      // Update global telemetry with final stats
      s.setTelemetry({ 
        totalTokens: useChatStore.getState().telemetry.totalTokens,
        tokensPerSecond: Number((useChatStore.getState().telemetry.totalTokens / event.executionTime).toFixed(1))
      });
      break;

    case 'error':
      s.appendToken(assistantId, `\n\n**Error:** ${event.message}`);
      s.setMessageStatus(assistantId, 'error');
      s.setActivePhase(null);
      break;
  }
}
