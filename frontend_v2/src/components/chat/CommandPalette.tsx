/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Terminal, Plus, Columns, Sun, Moon, 
  HelpCircle, MessageSquare, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';
import type { Chat } from '@/lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Chat[];
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  conversations = [],
  onSelectConversation,
  onCreateNewChat
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'actions' | 'chats' | 'help'>('actions');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleWorkspaceMode = useChatStore(s => s.toggleWorkspaceMode);
  const isWorkspaceMode = useChatStore(s => s.isWorkspaceMode);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveTab('actions');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle outside click / escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    onClose();
  };

  const actionItems = [
    {
      id: 'new-chat',
      title: 'Create New Conversation',
      description: 'Initialize a clean research timeline and start typing.',
      icon: <Plus size={16} className="text-accent-cyan" />,
      action: () => {
        onCreateNewChat();
        onClose();
      }
    },
    {
      id: 'workspace',
      title: 'Toggle Split Workspace Mode',
      description: isWorkspaceMode ? 'Collapse DAG timeline and code viewers.' : 'Expand split workspace panels.',
      icon: <Columns size={16} className="text-accent-purple" />,
      action: () => {
        toggleWorkspaceMode(!isWorkspaceMode);
        onClose();
      }
    },
    {
      id: 'theme',
      title: 'Toggle Platform Theme Mode',
      description: 'Switch between futuristic dark engine and high contrast light engine.',
      icon: <Moon size={16} className="text-amber-400" />,
      action: () => {
        toggleTheme();
      }
    },
    {
      id: 'help-view',
      title: 'Open Keyboard Shortcuts & Help',
      description: 'Display interactive neural key bindings cheatsheet.',
      icon: <HelpCircle size={16} className="text-emerald-400" />,
      action: () => {
        setActiveTab('help');
        setSelectedIndex(0);
      }
    }
  ];

  const filteredChats = conversations.filter(c => 
    (c.title || 'New Intelligence').toLowerCase().includes(query.toLowerCase())
  );

  const filteredActions = actionItems.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) || 
    a.description.toLowerCase().includes(query.toLowerCase())
  );

  // Compute items to display based on tab
  const displayItems = activeTab === 'actions' 
    ? filteredActions.map((item, idx) => ({ ...item, type: 'action' as const, index: idx }))
    : activeTab === 'chats'
    ? filteredChats.map((c, idx) => ({
        id: c.id,
        title: c.title || 'New Intelligence',
        description: `ID: ${c.id.substring(0, 8)}`,
        icon: <MessageSquare size={16} className="text-accent-cyan" />,
        action: () => {
          onSelectConversation(c.id);
          onClose();
        },
        type: 'chat' as const,
        index: idx
      }))
    : [];

  // Keybindings inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(displayItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + displayItems.length) % Math.max(displayItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayItems[selectedIndex]) {
        displayItems[selectedIndex].action();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setActiveTab(prev => prev === 'actions' ? 'chats' : prev === 'chats' ? 'help' : 'actions');
      setSelectedIndex(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Palette Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            onKeyDown={handleKeyDown}
            className="relative w-full max-w-xl bg-background border border-border-glass rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[480px]"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-glass bg-glass-overlay/30">
              <Search className="w-4 h-4 text-foreground-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder={activeTab === 'chats' ? "Search historical chats..." : "Type a command or search..."}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-foreground/10 text-[10px] font-mono text-foreground-muted border border-border-glass">ESC</kbd>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-border-glass bg-glass-overlay/10">
              <button 
                onClick={() => { setActiveTab('actions'); setSelectedIndex(0); }}
                className={`text-[10px] uppercase font-bold tracking-wider pb-1 transition-colors border-b ${activeTab === 'actions' ? 'border-accent-cyan text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
              >
                System Actions
              </button>
              <button 
                onClick={() => { setActiveTab('chats'); setSelectedIndex(0); }}
                className={`text-[10px] uppercase font-bold tracking-wider pb-1 transition-colors border-b ${activeTab === 'chats' ? 'border-accent-purple text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
              >
                History Search
              </button>
              <button 
                onClick={() => { setActiveTab('help'); setSelectedIndex(0); }}
                className={`text-[10px] uppercase font-bold tracking-wider pb-1 transition-colors border-b ${activeTab === 'help' ? 'border-accent-cyan text-foreground' : 'border-transparent text-foreground-muted hover:text-foreground'}`}
              >
                Shortcuts Guide
              </button>
            </div>

            {/* Results Grid / List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-none min-h-[220px]">
              {activeTab === 'help' ? (
                <div className="p-4 space-y-3.5 text-xs text-foreground-muted">
                  <h4 className="text-[10px] font-bold text-accent-cyan uppercase tracking-wider mb-2">Neural Key Bindings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between border-b border-border-glass pb-1.5">
                      <span>Open Command Palette</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+K</kbd>
                    </div>
                    <div className="flex items-center justify-between border-b border-border-glass pb-1.5">
                      <span>Create New Chat</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+N</kbd>
                    </div>
                    <div className="flex items-center justify-between border-b border-border-glass pb-1.5">
                      <span>Toggle Workspace Mode</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">Ctrl+\</kbd>
                    </div>
                    <div className="flex items-center justify-between border-b border-border-glass pb-1.5">
                      <span>Close Active View</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-glass-overlay border border-border-glass font-mono text-[10px]">ESC</kbd>
                    </div>
                  </div>
                </div>
              ) : displayItems.length === 0 ? (
                <div className="h-[220px] flex flex-col items-center justify-center text-center text-foreground-muted">
                  <HelpCircle size={24} className="opacity-30 mb-2 animate-pulse" />
                  <span className="text-xs">No matching system directives found</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {displayItems.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${isSelected ? 'bg-glass-overlay border border-border-glass' : 'border border-transparent'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-background shadow' : 'bg-foreground/5'}`}>
                            {item.icon}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs font-semibold truncate ${isSelected ? 'text-foreground' : 'text-foreground-muted'}`}>{item.title}</span>
                            <span className="text-[10px] text-foreground-muted/60 truncate leading-relaxed mt-0.5">{item.description}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-accent-cyan animate-in fade-in slide-in-from-right-1">
                            <span>Execute</span>
                            <CornerDownLeft size={10} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Command Palette Footer */}
            <div className="px-4 py-2 border-t border-border-glass bg-glass-overlay/10 flex items-center justify-between text-[9px] text-foreground-muted font-mono shrink-0">
              <div className="flex items-center gap-3">
                <span>↑↓ navigate</span>
                <span>⏎ select</span>
                <span>⇥ switch tab</span>
              </div>
              <div>Raycast Interface v1.0</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

