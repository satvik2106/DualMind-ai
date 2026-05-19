'use client';

import { useChatStore } from '@/lib/store/chatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BrainCircuit, 
  Search, 
  Network, 
  CheckCircle2, 
  Clock, 
  Activity,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { useEffect, useRef } from 'react';

// Map event types to icons and colors
const getEventConfig = (type: string, agent?: string) => {
  if (type === 'agent_thinking') return { icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
  if (type === 'memory_recall') return { icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-400/10' };
  if (type === 'tool_started') return { icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10' };
  if (type === 'tool_completed') return { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' };
  if (type === 'verification_critique') return { icon: Activity, color: 'text-orange-400', bg: 'bg-orange-400/10' };
  if (type === 'confidence_update') return { icon: Network, color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
  if (type === 'artifact_generating' || type === 'chart_rendering') return { icon: Activity, color: 'text-pink-400', bg: 'bg-pink-400/10' };
  
  return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-400/10' };
};

export default function CognitionTimeline() {
  const timeline = useChatStore(s => s.cognitiveTimeline);
  const isStreaming = useChatStore(s => s.isStreaming);
  const streamStatus = useChatStore(s => s.streamStatus);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [timeline.length]);

  if (timeline.length === 0) return null;

  return (
    <div className="my-8 relative pl-4 max-w-3xl mx-auto">
      {/* The cinematic neural spine */}
      <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-accent-cyan/0 via-accent-cyan/50 to-accent-cyan/0" />
      
      <div 
        ref={containerRef}
        className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-none pr-4"
      >
        <AnimatePresence initial={false}>
          {timeline.map((evt, i) => {
            const config = getEventConfig(evt.type, evt.agent);
            const Icon = config.icon;
            
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative flex items-start gap-4 group"
              >
                {/* Node connector line */}
                <div className="absolute left-[1.125rem] top-4 w-4 h-px bg-white/10" />
                
                {/* Node icon */}
                <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-white/10 ${config.bg} ${config.color} shadow-lg shadow-black/50`}>
                  <Icon size={12} />
                  {/* Pulse effect for the latest active node */}
                  {i === timeline.length - 1 && (
                    <span className={`absolute inset-0 rounded-full animate-ping opacity-50 ${config.bg.replace('/10', '')}`} />
                  )}
                </div>

                {/* Event Card */}
                <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                      {evt.agent ? (
                        <>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white`}>
                            {evt.agent}
                          </span>
                          <span className="opacity-50">•</span>
                        </>
                      ) : null}
                      <span className={config.color}>{evt.type.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="text-[10px] text-foreground-muted/50 font-mono">
                      {new Date(evt.timestamp).toISOString().split('T')[1].slice(0, -1)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-foreground/90 font-mono leading-relaxed">
                    {evt.content}
                  </div>
                  
                  {/* Additional metadata visuals (e.g. confidence bars) */}
                  {evt.type === 'confidence_update' && evt.metadata?.overall !== undefined && (
                    <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${evt.metadata.overall * 100}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-accent-cyan"
                      />
                    </div>
                  )}
                  {evt.type === 'verification_critique' && (
                    <div className="mt-2 text-xs flex items-center gap-2">
                      <div className="px-2 py-1 bg-black/40 rounded flex items-center gap-2 text-orange-300">
                        <AlertTriangle size={12} />
                        Score: {evt.metadata?.score}/100
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-4 pl-[0.875rem] py-2">
            <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)] ${
              streamStatus === 'connecting' ? 'bg-accent-purple' :
              streamStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-accent-cyan'
            }`} />
            <div className={`text-xs font-mono uppercase tracking-widest animate-pulse ${
              streamStatus === 'connecting' ? 'text-accent-purple' :
              streamStatus === 'reconnecting' ? 'text-yellow-400' : 'text-accent-cyan'
            }`}>
              {streamStatus === 'connecting' && 'Initializing Neural Orchestration Pipeline...'}
              {streamStatus === 'reconnecting' && 'Re-establishing Neural Link...'}
              {streamStatus === 'streaming' && 'Orchestrating Cognitive Subsystems...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
