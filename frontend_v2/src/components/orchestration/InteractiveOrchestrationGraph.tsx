'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Search, Code2, ShieldCheck, Sparkles } from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';

// --- Configuration & Types ---

type NodePos = { x: number; y: number };
type AgentID = 'planner' | 'researcher' | 'coder' | 'verifier' | 'synthesizer';

interface NeuralNodeProps {
  id: AgentID;
  label: string;
  icon: React.ReactNode;
  pos: NodePos;
  status: 'idle' | 'active' | 'completed' | 'error';
  activePhase: string | null;
}

interface NeuralEdgeProps {
  from: NodePos;
  to: NodePos;
  isActive: boolean;
  isCompleted: boolean;
}

// --- Sub-Components ---

const NeuralNode = memo(({ id, label, icon, pos, status, activePhase }: NeuralNodeProps) => {
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  return (
    <motion.g
      initial={false}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      {/* Outer Glow Ring */}
      <AnimatePresence>
        {isActive && (
          <motion.circle
            initial={{ r: 24, opacity: 0 }}
            animate={{ r: [24, 32, 24], opacity: [0.5, 0.2, 0.5] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="fill-accent-cyan/10 stroke-accent-cyan/20 stroke-[1px]"
          />
        )}
      </AnimatePresence>

      {/* Node Body */}
      <motion.circle
        r={22}
        className={`
          ${isActive ? 'fill-accent-cyan/20 stroke-accent-cyan shadow-[0_0_20px_rgba(0,229,255,0.4)]' : 
            isCompleted ? 'fill-emerald-500/10 stroke-emerald-500/50' :
            isError ? 'fill-red-500/10 stroke-red-500/50' :
            'fill-white/5 stroke-white/10'}
          stroke-[1.5px] transition-colors duration-500
        `}
      />

      {/* Content */}
      <foreignObject x={-12} y={-12} width={24} height={24}>
        <div className={`flex items-center justify-center w-full h-full ${isActive ? 'text-accent-cyan' : isCompleted ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-foreground-muted'}`}>
          {icon}
        </div>
      </foreignObject>

      {/* Label */}
      <text
        y={36}
        textAnchor="middle"
        className={`text-[9px] font-bold tracking-widest uppercase transition-colors duration-500 ${isActive ? 'fill-accent-cyan' : isCompleted ? 'fill-emerald-400' : 'fill-foreground-muted/60'}`}
      >
        {label}
      </text>
    </motion.g>
  );
});

const NeuralEdge = memo(({ from, to, isActive, isCompleted }: NeuralEdgeProps) => {
  return (
    <g>
      {/* Base Path */}
      <path
        d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
        className={`stroke-[1.5px] fill-none transition-colors duration-700 ${isCompleted ? 'stroke-emerald-500/30' : isActive ? 'stroke-accent-cyan/30' : 'stroke-white/5'}`}
      />

      {/* Animated Flow Wave */}
      <AnimatePresence>
        {isActive && (
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
            className="stroke-accent-cyan stroke-[2px] fill-none shadow-[0_0_10px_rgba(0,229,255,0.8)]"
          />
        )}
      </AnimatePresence>
    </g>
  );
});

// --- Main Component ---

const NeuralParticles = memo(() => {
  // Deterministic particle positions — avoids SSR/client hydration mismatch from Math.random()
  const particles = useMemo(() => [
    { id: 0, x: '12%', y: '78%', duration: 5.2, delay: 0.3 },
    { id: 1, x: '45%', y: '22%', duration: 6.8, delay: 1.1 },
    { id: 2, x: '73%', y: '55%', duration: 4.5, delay: 2.4 },
    { id: 3, x: '28%', y: '91%', duration: 7.1, delay: 0.8 },
    { id: 4, x: '88%', y: '34%', duration: 5.9, delay: 3.2 },
    { id: 5, x: '56%', y: '67%', duration: 6.3, delay: 1.7 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: p.x, y: p.y, opacity: 0 }}
          animate={{ 
            y: [null, '-20%'], 
            opacity: [0, 0.3, 0],
            scale: [0.5, 1.2, 0.5]
          }}
          transition={{ 
            duration: p.duration, 
            repeat: Infinity, 
            delay: p.delay 
          }}
          className="absolute w-1 h-1 bg-accent-cyan rounded-full blur-[1px]"
        />
      ))}
    </div>
  );
});

function InteractiveOrchestrationGraph() {
  const agents = useChatStore(s => s.agents);
  const activePhase = useChatStore(s => s.activePhase);

  // Define layout positions (relative to 100x220 space)
  const NODE_MAP: Record<AgentID, { label: string; icon: React.ReactNode; pos: NodePos }> = useMemo(() => ({
    planner:     { label: 'Planner',     icon: <BrainCircuit className="w-4 h-4" />, pos: { x: 50, y: 30 } },
    researcher:  { label: 'Researcher',  icon: <Search       className="w-4 h-4" />, pos: { x: 25, y: 80 } },
    coder:       { label: 'Coder',       icon: <Code2        className="w-4 h-4" />, pos: { x: 75, y: 80 } },
    verifier:    { label: 'Verifier',    icon: <ShieldCheck  className="w-4 h-4" />, pos: { x: 50, y: 130 } },
    synthesizer: { label: 'Synthesizer', icon: <Sparkles     className="w-4 h-4" />, pos: { x: 50, y: 185 } },
  }), []);

  const getAgentStatus = (id: AgentID) => agents.find(a => a.name === id)?.status || 'idle';

  const edges = useMemo(() => [
    { from: 'planner', to: 'researcher' },
    { from: 'planner', to: 'coder' },
    { from: 'researcher', to: 'verifier' },
    { from: 'coder', to: 'verifier' },
    { from: 'verifier', to: 'synthesizer' },
  ], []);

  return (
    <div className="w-full aspect-[4/5] relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Neural Background Ambient */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent-cyan/5 via-transparent to-accent-purple/5 opacity-40" />
      
      {/* SVG Canvas */}
      <svg
        viewBox="0 0 100 220"
        className="w-full h-full relative z-10"
        style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }}
      >
        {/* Render Edges */}
        {edges.map((edge, i) => {
          const fromNode = NODE_MAP[edge.from as AgentID];
          const toNode = NODE_MAP[edge.to as AgentID];
          const fromStatus = getAgentStatus(edge.from as AgentID);
          const toStatus = getAgentStatus(edge.to as AgentID);
          
          return (
            <NeuralEdge
              key={`edge-${i}`}
              from={fromNode.pos}
              to={toNode.pos}
              isActive={fromStatus === 'active' || (fromStatus === 'completed' && toStatus === 'active')}
              isCompleted={fromStatus === 'completed' && toStatus === 'completed'}
            />
          );
        })}

        {/* Render Nodes */}
        {(Object.keys(NODE_MAP) as AgentID[]).map((id) => {
          const node = NODE_MAP[id];
          return (
            <NeuralNode
              key={id}
              id={id}
              label={node.label}
              icon={node.icon}
              pos={node.pos}
              status={getAgentStatus(id)}
              activePhase={activePhase}
            />
          );
        })}
      </svg>

      <NeuralParticles />
    </div>
  );
}

export default memo(InteractiveOrchestrationGraph);
