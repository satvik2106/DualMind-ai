/* eslint-disable */
'use client';

import { useChatStore } from '@/lib/store/chatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, XCircle, ShieldAlert, Cpu } from 'lucide-react';
import { streamChat } from '@/lib/streaming/sseClient';

export default function ErrorSurface() {
  const { errorDetail, streamStatus, messages, messages: allMessages } = useChatStore();

  if (!errorDetail || streamStatus !== 'error') return null;

  const handleRetry = async () => {
    const lastUserMessage = [...allMessages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // Remove the errored message and retry
      useChatStore.setState(s => ({
        messages: s.messages.filter(m => m.status !== 'error')
      }));
      await streamChat(lastUserMessage.content);
    }
  };

  const handleDismiss = () => {
    useChatStore.getState().setErrorDetail(null);
    useChatStore.getState().setStreamStatus('idle');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md"
    >
      <div className="glass-panel max-w-md w-full p-8 border border-red-500/30 bg-red-500/5 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-500/10 blur-[100px] rounded-full" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2 uppercase">Neural Link Interrupted</h2>
          <div className="flex items-center gap-2 mb-6">
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-[10px] font-mono font-bold text-red-400 border border-red-500/30">
              {errorDetail.code}
            </span>
            <div className="h-px w-8 bg-red-500/30" />
            <Cpu className="w-3 h-3 text-red-500/50" />
          </div>

          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            The orchestration pipeline encountered a critical synchronization failure. 
            <br />
            <span className="text-red-300/60 text-xs italic mt-2 block font-mono">
              {errorDetail.message}
            </span>
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)] group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Re-Initialize Neural Link
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-3 glass-panel border border-white/10 text-white/60 rounded-xl font-bold text-sm hover:bg-white/5 transition-colors"
            >
              Abort Operation
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

