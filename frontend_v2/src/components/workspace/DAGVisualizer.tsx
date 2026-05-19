/* eslint-disable */
'use client';

import { useChatStore } from '@/lib/store/chatStore';
import { motion } from 'framer-motion';
import { Network, Activity } from 'lucide-react';
import { useMemo, useRef, useEffect, useState } from 'react';

/**
 * Cinematic SVG Connections
 */
function Edge({ startX, startY, endX, endY, status }: { startX: number, startY: number, endX: number, endY: number, status: string }) {
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  let strokeColor = 'rgba(255, 255, 255, 0.1)';
  if (isRunning) strokeColor = 'rgba(59, 130, 246, 0.5)';
  if (isSuccess) strokeColor = 'rgba(34, 197, 94, 0.3)';
  if (isError) strokeColor = 'rgba(239, 68, 68, 0.5)';

  // Cubic bezier for a smooth flowing edge
  const controlPointX = startX + (endX - startX) / 2;
  const path = `M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`;

  return (
    <>
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="2" />
      {isRunning && (
        <motion.circle
          r="4"
          fill="rgb(59, 130, 246)"
          filter="blur(2px)"
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{ offsetPath: `path('${path}')` } as any}
        />
      )}
    </>
  );
}

export default function DAGVisualizer() {
  const messages = useChatStore(s => s.messages);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.scrollWidth,
        height: containerRef.current.scrollHeight
      });
    }
  }, [messages]);
  
  const activeMessage = [...messages].reverse().find(m => m.plan);
  if (!activeMessage || !activeMessage.plan) return null;

  const plan = activeMessage.plan;
  const pipeline = plan.pipeline || [];
  const toolRecords = activeMessage.toolRecords || [];

  const levels = useMemo(() => {
    if (!pipeline.length) return [];
    
    const depths = new Map<number, number>();
    
    pipeline.forEach(node => {
      if (!node.depends_on || node.depends_on.length === 0) {
        depths.set(node.step, 0);
      }
    });

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      
      pipeline.forEach(node => {
        if (depths.has(node.step)) return;
        
        let canResolve = true;
        let maxDepDepth = -1;
        
        for (const depId of (node.depends_on || [])) {
          if (!depths.has(depId)) {
            canResolve = false;
            break;
          }
          maxDepDepth = Math.max(maxDepDepth, depths.get(depId)!);
        }
        
        if (canResolve) {
          depths.set(node.step, maxDepDepth + 1);
          changed = true;
        }
      });
    }

    pipeline.forEach(node => {
      if (!depths.has(node.step)) depths.set(node.step, 0);
    });

    const maxDepth = Math.max(0, ...Array.from(depths.values()));
    const grouped: any[][] = Array.from({ length: maxDepth + 1 }, () => []);
    
    pipeline.forEach(node => {
      const d = depths.get(node.step)!;
      const record = toolRecords.find(t => t.step === node.step);
      grouped[d].push({
        ...node,
        status: record ? record.status : 'pending',
      });
    });

    return grouped;
  }, [pipeline, toolRecords]);

  if (levels.length === 0) return null;

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-6 rounded-xl bg-background-secondary border border-border-glass shadow-2xl">
      <div className="flex items-center gap-2 mb-6 text-accent-cyan font-mono text-sm tracking-widest uppercase z-10 shrink-0">
        <Activity size={16} className="animate-pulse" />
        <span>Cognitive Topology</span>
        <div className="ml-auto flex items-center gap-4 text-xs font-sans capitalize tracking-normal text-foreground-muted">
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-foreground-muted/40"/> Pending</span>
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"/> Running</span>
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400"/> Success</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative scrollbar-none" ref={containerRef}>
        <div className="flex items-center gap-16 min-w-max p-8 relative">
          
          {/* Edges layer - in a real app we would calculate exact element positions. 
              Here we use CSS to position nodes and just draw stylistic background connection lines. */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          {levels.map((levelNodes, levelIndex) => (
            <div key={`level-${levelIndex}`} className="flex flex-col gap-8 relative z-10">
              
              {levelNodes.map((node) => {
                const isPending = node.status === 'pending';
                const isRunning = node.status === 'running';
                const isSuccess = node.status === 'success';
                const isError = node.status === 'error';

                let borderColor = 'border-border-glass';
                let bgColor = 'bg-glass-overlay';
                let textColor = 'text-foreground-muted';
                let pulseEffect = '';
                let glowLayer = null;

                if (isRunning) {
                  borderColor = 'border-blue-500/50';
                  bgColor = 'bg-blue-900/20 backdrop-blur-xl';
                  textColor = 'text-blue-100';
                  pulseEffect = 'shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-[1.02] z-20';
                  glowLayer = <div className="absolute -inset-1 bg-blue-500/20 blur-xl rounded-2xl animate-pulse" />;
                } else if (isSuccess) {
                  borderColor = 'border-green-500/30';
                  bgColor = 'bg-green-900/10 backdrop-blur-md';
                  textColor = 'text-green-100';
                } else if (isError) {
                  borderColor = 'border-red-500/50';
                  bgColor = 'bg-red-900/20 backdrop-blur-md';
                  textColor = 'text-red-100';
                  pulseEffect = 'shadow-[0_0_20px_rgba(239,68,68,0.2)]';
                }

                return (
                  <motion.div
                    key={node.step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: levelIndex * 0.1 + (node.step * 0.05), duration: 0.5, type: 'spring' }}
                    className={`relative w-72 p-5 rounded-2xl border transition-all duration-700 ${borderColor} ${bgColor} ${pulseEffect}`}
                  >
                    {glowLayer}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono font-bold bg-background px-2 py-1 rounded-md text-foreground-muted border border-border-glass">
                          T.{node.step}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-80 text-accent-cyan">
                          {node.tool.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className={`text-sm ${textColor} leading-relaxed`}>
                        {node.purpose}
                      </p>
                      
                      {isRunning && (
                        <div className="mt-4 flex items-center gap-2">
                          <div className="h-1 flex-1 bg-foreground-muted/20 rounded-full overflow-hidden relative">
                            <motion.div 
                              className="absolute top-0 bottom-0 left-0 bg-blue-400"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                            />
                          </div>
                          <span className="text-[9px] font-mono uppercase text-blue-300">Executing</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {plan.reasoning && (
        <div className="mt-4 pt-4 border-t border-border-glass text-xs font-mono text-foreground/80 bg-glass-overlay p-4 rounded-xl shrink-0">
          <span className="text-accent-cyan mr-2 font-bold uppercase tracking-wider">Strategic Directive:</span>
          {plan.reasoning}
        </div>
      )}
    </div>
  );
}


