'use client';

import { useChatStore } from '@/lib/store/chatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Clock, ShieldCheck, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react';

export default function TelemetryPanel() {
  const isStreaming = useChatStore(s => s.isStreaming);
  const streamStatus = useChatStore(s => s.streamStatus);
  const telemetry = useChatStore(s => s.telemetry);
  const errorDetail = useChatStore(s => s.errorDetail);

  if (!isStreaming && streamStatus === 'idle') return null;

  const getStatusColor = () => {
    switch (streamStatus) {
      case 'streaming': return 'text-accent-cyan';
      case 'connecting': return 'text-accent-purple';
      case 'reconnecting': return 'text-yellow-400';
      case 'error': return 'text-red-500';
      default: return 'text-foreground-muted';
    }
  };

  const getStatusIcon = () => {
    switch (streamStatus) {
      case 'streaming': return <Activity className="w-3 h-3 animate-pulse" />;
      case 'connecting': return <Zap className="w-3 h-3 animate-pulse" />;
      case 'reconnecting': return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'error': return <WifiOff className="w-3 h-3" />;
      default: return <Wifi className="w-3 h-3" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 right-8 z-50 pointer-events-none"
    >
      <div className="glass-panel p-4 min-w-[240px] flex flex-col gap-3 pointer-events-auto bg-background/40 backdrop-blur-xl border border-border-glass shadow-2xl">
        {/* Header / Status */}
        <div className="flex items-center justify-between border-b border-border-glass pb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-full bg-glass-overlay ${getStatusColor()}`}>
              {getStatusIcon()}
            </div>
            <span className={`text-[10px] font-bold tracking-widest uppercase ${getStatusColor()}`}>
              {streamStatus}
            </span>
          </div>
          <span className="text-[10px] text-foreground-muted font-mono">
            {telemetry.model.toUpperCase()}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricItem 
            label="Throughput" 
            value={`${telemetry.tokensPerSecond}`} 
            unit="t/s" 
            icon={<Zap className="w-3 h-3 text-accent-cyan" />}
          />
          <MetricItem 
            label="Latency" 
            value={`${telemetry.latency}`} 
            unit="ms" 
            icon={<Clock className="w-3 h-3 text-accent-purple" />}
          />
        </div>

        {/* Live Indicator Bar */}
        <div className="h-1 w-full bg-glass-overlay rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-deep-purple"
            animate={{ 
              x: streamStatus === 'streaming' ? ['-100%', '100%'] : '0%' 
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          />
        </div>

        {/* Error Detail */}
        <AnimatePresence>
          {errorDetail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-1 p-2 rounded bg-red-500/10 border border-red-500/20 flex gap-2"
            >
              <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">
                  {errorDetail.code}
                </span>
                <span className="text-[10px] text-red-200/70 leading-tight">
                  {errorDetail.message}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MetricItem({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] uppercase tracking-tighter text-foreground-muted font-medium">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-mono font-bold tracking-tight text-foreground">
          {value}
        </span>
        <span className="text-[10px] text-foreground-muted/50 font-medium">
          {unit}
        </span>
      </div>
    </div>
  );
}
