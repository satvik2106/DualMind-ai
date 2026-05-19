/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Shield, Key, CreditCard, Sparkles, 
  Terminal, Sliders, CheckCircle2, ChevronRight
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  userEmail = 'developer@dualmind.ai',
  userName = 'Principal Architect'
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'intelligence' | 'shortcuts' | 'billing'>('profile');

  const tabs = [
    { id: 'profile', label: 'General & Profile', icon: <User size={14} /> },
    { id: 'intelligence', label: 'AI Cognition Panel', icon: <Sliders size={14} /> },
    { id: 'shortcuts', label: 'Key Shortcuts', icon: <Terminal size={14} /> },
    { id: 'billing', label: 'SaaS Subscription', icon: <CreditCard size={14} /> }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative w-full max-w-3xl h-[520px] bg-background border border-border-glass rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col md:flex-row"
          >
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56 bg-background-secondary border-b md:border-b-0 md:border-r border-border-glass p-4 shrink-0 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-accent-cyan mb-1">DualMind OS</h3>
                  <p className="text-[10px] text-foreground-muted">System Preferences</p>
                </div>

                <div className="space-y-1">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${activeTab === tab.id ? 'bg-glass-overlay text-foreground border border-border-glass' : 'text-foreground-muted hover:text-foreground border border-transparent'}`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden md:block text-[9px] text-foreground-muted/50 font-mono">
                System Kernel v1.2.6
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
              {/* Close Button */}
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-glass-overlay rounded-full text-foreground-muted hover:text-foreground transition-colors z-20 border border-border-glass"
              >
                <X size={14} />
              </button>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-none">
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">General & Profile Settings</h2>
                      <p className="text-xs text-foreground-muted leading-relaxed">Manage developer nodes, system-wide settings, and authentication details.</p>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-glass-overlay border border-border-glass">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 flex items-center justify-center text-sm font-bold text-foreground ring-1 ring-border-glass">
                        {userName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground">{userName}</div>
                        <div className="text-[10px] text-foreground-muted mt-0.5 truncate">{userEmail}</div>
                      </div>
                      <div className="px-2 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-[9px] font-mono text-accent-cyan">
                        Root Access
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-border-glass text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">Visual theme mode</span>
                          <span className="text-[10px] text-foreground-muted">Toggle root aesthetic variables.</span>
                        </div>
                        <ThemeToggle className="p-2 border border-border-glass rounded-xl hover:bg-glass-overlay" />
                      </div>

                      <div className="flex items-center justify-between py-3 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground">API request logs</span>
                          <span className="text-[10px] text-foreground-muted">Persist agent transaction pipelines locally.</span>
                        </div>
                        <div className="w-8 h-4 rounded-full bg-accent-cyan relative flex items-center px-0.5 cursor-pointer">
                          <div className="w-3 h-3 rounded-full bg-background absolute right-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'intelligence' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">AI Cognition Settings</h2>
                      <p className="text-xs text-foreground-muted leading-relaxed">Customize pipeline latency-verification ratios, model preferences, and agent trace limits.</p>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-foreground-muted tracking-wider">Default Reasoning Depth</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button className="p-3 text-left rounded-xl border border-border-glass bg-glass-overlay/30 text-xs">
                            <div className="font-bold text-foreground">Fast Plan</div>
                            <div className="text-[9px] text-foreground-muted mt-0.5">Low-latency pipelines</div>
                          </button>
                          <button className="p-3 text-left rounded-xl border border-accent-cyan bg-accent-cyan/5 text-xs">
                            <div className="font-bold text-accent-cyan">Autonomous RAG</div>
                            <div className="text-[9px] text-accent-cyan/70 mt-0.5">Dual-layer synthesis</div>
                          </button>
                          <button className="p-3 text-left rounded-xl border border-border-glass bg-glass-overlay/30 text-xs opacity-60">
                            <div className="font-bold text-foreground">Deep Proof</div>
                            <div className="text-[9px] text-foreground-muted mt-0.5">Maximum verification</div>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">Synthesis confidence gate</span>
                          <span className="font-mono text-accent-cyan">85%</span>
                        </div>
                        <div className="h-1.5 w-full bg-glass-overlay border border-border-glass rounded-full overflow-hidden">
                          <div className="h-full w-[85%] bg-accent-cyan" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'shortcuts' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Keyboard Shortcuts</h2>
                      <p className="text-xs text-foreground-muted leading-relaxed">Keyboard bindings to control the AGI engine.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs py-2 border-b border-border-glass">
                        <span className="text-foreground-muted">Open Raycast Command Palette</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+K</kbd>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-b border-border-glass">
                        <span className="text-foreground-muted">Toggle Workspace Mode</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+\</kbd>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-b border-border-glass">
                        <span className="text-foreground-muted">Initialize New Chat Session</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+N</kbd>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-b border-border-glass">
                        <span className="text-foreground-muted">Close Prefs / Overlay Dialogs</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">ESC</kbd>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Billing & Subscriptions</h2>
                        <p className="text-xs text-foreground-muted leading-relaxed">Scale reasoning computations dynamically with premium quotas.</p>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-accent-cyan/15 border border-accent-cyan/20 text-[10px] font-bold text-accent-cyan flex items-center gap-1">
                        <Sparkles size={10} /> Active Free Tier
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Standard Card */}
                      <div className="p-4 rounded-2xl border border-border-glass bg-glass-overlay/30 space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-foreground-muted">Standard Node</div>
                          <div className="text-xl font-bold mt-1 text-foreground">$0 <span className="text-xs text-foreground-muted">/mo</span></div>
                          <p className="text-[10px] text-foreground-muted leading-relaxed mt-2">Unlimited baseline chat history and primary model research pathways.</p>
                        </div>
                        <button className="w-full py-2 rounded-xl bg-glass-overlay border border-border-glass text-[10px] font-bold text-foreground-muted cursor-not-allowed">
                          Active Tier
                        </button>
                      </div>

                      {/* Quantum Engine Card */}
                      <div className="p-4 rounded-2xl border border-accent-cyan/40 bg-accent-cyan/[0.02] space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-accent-cyan/10 to-transparent rounded-bl-full pointer-events-none" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-accent-cyan">Quantum Agent</div>
                          <div className="text-xl font-bold mt-1 text-foreground">$20 <span className="text-xs text-foreground-muted">/mo</span></div>
                          <p className="text-[10px] text-foreground-muted leading-relaxed mt-2">Access to high-capacity parallel synthesis cores and autonomous verify tracing.</p>
                        </div>
                        <button 
                          onClick={() => alert("Billing logic placeholder. Thank you for supporting DualMind!")}
                          className="w-full py-2 rounded-xl bg-accent-cyan text-background text-[10px] font-bold hover:bg-accent-cyan/90 transition-colors shadow-lg shadow-accent-cyan/10"
                        >
                          Upgrade Node
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

