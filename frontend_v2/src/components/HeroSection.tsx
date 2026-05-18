'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-4 overflow-hidden">
      <div className="z-10 text-center max-w-5xl mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 relative"
        >
          <div className="absolute inset-0 blur-2xl bg-accent-cyan/20 rounded-full" />
          <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-accent-cyan/30 bg-accent-cyan/5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-cyan"></span>
            </span>
            <span className="text-sm font-medium text-accent-cyan tracking-wide uppercase">DualMind OS v2.0 Online</span>
          </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-8 leading-[1.1]"
        >
          <span className="text-foreground">Autonomous</span>
          <br />
          <span className="bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-deep-purple bg-clip-text text-transparent">
            Intelligence.
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl md:text-2xl text-foreground-muted max-w-2xl mx-auto mb-12 font-light"
        >
          Where multiple AI agents think, plan, code, and execute together in a next-generation neural operating system.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <Link 
            href="/chat"
            className="group relative px-8 py-4 bg-foreground text-background font-semibold rounded-full overflow-hidden transition-all hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan to-accent-purple opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <span className="relative z-10 text-lg">Initialize System</span>
          </Link>
          
          <Link 
            href="#agents"
            className="px-8 py-4 glass text-foreground font-semibold rounded-full hover:bg-glass-highlight transition-colors text-lg"
          >
            Explore Architecture
          </Link>
        </motion.div>
      </div>

      {/* Futuristic central graphic below text */}
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl mt-24 relative z-0"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-full" />
        <div className="relative aspect-[21/9] rounded-t-3xl border-t border-x border-border-glass glass-panel overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-[0.15] dark:opacity-30 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />
          
          {/* Mockup UI lines */}
          <div className="absolute top-4 left-4 right-4 flex gap-2">
            <div className="h-2 w-12 rounded-full bg-foreground/20" />
            <div className="h-2 w-24 rounded-full bg-foreground/10" />
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-accent-cyan/20 rounded-full flex items-center justify-center animate-spin-slow">
            <div className="w-48 h-48 border border-accent-purple/30 rounded-full border-dashed" />
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-32 h-32 bg-background rounded-full border border-border-glass shadow-[0_0_50px_rgba(0,229,255,0.3)] flex items-center justify-center backdrop-blur-md">
              <span className="text-4xl text-glow-cyan font-bold tracking-tighter">DM</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
