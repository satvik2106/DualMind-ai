/* eslint-disable */
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Pin, MessageSquare, Trash2, Edit3, 
  ChevronRight, Calendar, Archive, Bookmark
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import type { Chat } from '@/lib/api';

interface MemoryTimelineProps {
  conversations: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}

export default function MemoryTimeline({ 
  conversations = [], 
  activeId, 
  onSelect, 
  onDelete, 
  onPin 
}: MemoryTimelineProps) {
  
  const grouped = useMemo(() => {
    const pins = conversations.filter(c => c.isPinned);
    const others = conversations.filter(c => !c.isPinned);

    const categories = {
      pinned: pins,
      today: others.filter(c => c.updatedAt && isToday(new Date(c.updatedAt))),
      yesterday: others.filter(c => c.updatedAt && isYesterday(new Date(c.updatedAt))),
      thisWeek: others.filter(c => c.updatedAt && !isToday(new Date(c.updatedAt)) && !isYesterday(new Date(c.updatedAt)) && isThisWeek(new Date(c.updatedAt))),
      previous: others.filter(c => !c.updatedAt || (!isToday(new Date(c.updatedAt)) && !isYesterday(new Date(c.updatedAt)) && !isThisWeek(new Date(c.updatedAt)))),
    };

    return categories;
  }, [conversations]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none space-y-6 py-4">
      {/* Pinned Section */}
      {grouped.pinned.length > 0 && (
        <TimelineSection 
          title="Pinned Intelligence" 
          icon={<Pin className="w-3 h-3 text-accent-cyan" />}
          items={grouped.pinned}
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          onPin={onPin}
          isPinnedView
        />
      )}

      {/* Epochs */}
      <TimelineSection 
        title="Recent Cycles" 
        icon={<Calendar className="w-3 h-3 text-accent-purple" />}
        items={grouped.today}
        activeId={activeId}
        onSelect={onSelect}
        onDelete={onDelete}
        onPin={onPin}
      />

      <TimelineSection 
        title="Yesterday" 
        icon={<History className="w-3 h-3 text-foreground-muted" />}
        items={grouped.yesterday}
        activeId={activeId}
        onSelect={onSelect}
        onDelete={onDelete}
        onPin={onPin}
      />

      <TimelineSection 
        title="Neural History" 
        icon={<Archive className="w-3 h-3 text-foreground-muted" />}
        items={grouped.previous}
        activeId={activeId}
        onSelect={onSelect}
        onDelete={onDelete}
        onPin={onPin}
      />
    </div>
  );
}

function TimelineSection({ 
  title, 
  icon, 
  items, 
  activeId, 
  onSelect, 
  onDelete, 
  onPin,
  isPinnedView = false
}: { 
  title: string; 
  icon: React.ReactNode;
  items: Chat[]; 
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
  isPinnedView?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="px-2">
      <div className="px-4 py-2 flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-[0.2em]">
          {title}
        </span>
      </div>
      
      <div className="space-y-0.5 relative pl-4 ml-3 border-l border-border-glass">
        <AnimatePresence mode="popLayout">
          {items.map((conv) => (
            <TimelineItem
              key={conv.id}
              conv={conv}
              isActive={activeId === conv.id}
              onSelect={onSelect}
              onDelete={onDelete}
              onPin={onPin}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TimelineItem({ 
  conv, 
  isActive, 
  onSelect, 
  onDelete, 
  onPin 
}: { 
  conv: Chat; 
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group"
    >
      {/* Node Dot */}
      <div className={`
        absolute -left-[21px] top-4 w-2 h-2 rounded-full border bg-background z-10 transition-all duration-300
        ${isActive ? 'border-accent-cyan scale-125 shadow-[0_0_8px_rgba(0,229,255,0.6)]' : 'border-border-glass group-hover:border-border-subtle'}
      `} />

      <div
        onClick={() => onSelect(conv.id)}
        className={`
          w-full text-left px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer flex items-center gap-3 relative overflow-hidden
          ${isActive ? 'bg-glass-overlay text-foreground border border-border-glass' : 'hover:bg-glass-overlay text-foreground-muted hover:text-foreground border border-transparent'}
        `}
      >
        {/* Active Glow */}
        {isActive && (
          <motion.div 
            layoutId="activeGlow"
            className="absolute left-0 top-0 bottom-0 w-1 bg-accent-cyan shadow-[0_0_15px_rgba(0,229,255,0.5)]"
          />
        )}

        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-accent-cyan' : 'opacity-40'}`} />
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate leading-relaxed">
            {conv.title || 'New Intelligence'}
          </div>
          {conv.updatedAt && (
            <div className="text-[9px] opacity-40 font-mono mt-0.5">
              {format(new Date(conv.updatedAt), 'HH:mm')} • {conv.userId.substring(0, 4)}
            </div>
          )}
        </div>

        {/* Actions Overlay */}
        <div className={`
          flex items-center gap-1.5 transition-opacity duration-300
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <button 
            onClick={(e) => { e.stopPropagation(); onPin(conv.id, !conv.isPinned); }}
            className="p-1.5 rounded-lg hover:bg-glass-overlay text-foreground-muted hover:text-accent-cyan transition-colors"
          >
            <Pin className={`w-3 h-3 ${conv.isPinned ? 'fill-accent-cyan text-accent-cyan' : ''}`} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
            className="p-1.5 rounded-lg hover:bg-glass-overlay text-foreground-muted hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Hover Preview Tooltip (Neural Memory) */}
      <AnimatePresence>
        {isHovered && !isActive && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute left-[105%] top-0 z-50 w-48 p-3 glass-panel border border-border-glass shadow-2xl pointer-events-none"
          >
            <div className="text-[10px] font-bold text-accent-purple uppercase tracking-wider mb-2">Memory Preview</div>
            <div className="text-[10px] text-foreground-muted line-clamp-3 leading-relaxed italic">
              "Restoring previous session context... Agent Researcher identified 4 key papers on neural architecture."
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 bg-glass-overlay rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-accent-cyan" />
              </div>
              <span className="text-[8px] font-mono text-accent-cyan">84% Match</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

