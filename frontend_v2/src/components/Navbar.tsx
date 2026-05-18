'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { ThemeToggle } from './ThemeToggle';

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4"
    >
      <div className="glass rounded-full px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.4)]">
            <span className="text-white text-sm font-bold">DM</span>
          </div>
          <span className="text-foreground font-semibold tracking-wide text-lg">DualMind</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground-muted">
          <Link href="#features" className="hover:text-foreground transition-colors">Platform</Link>
          <Link href="#agents" className="hover:text-foreground transition-colors">Agents</Link>
          <Link href="#infrastructure" className="hover:text-foreground transition-colors">Infrastructure</Link>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle className="rounded-full" />
          <Link 
            href={status === 'authenticated' ? "/chat" : "/login"} 
            className="px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-bold hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2 group"
          >
            <span>Launch Workspace</span>
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan group-hover:animate-ping" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
