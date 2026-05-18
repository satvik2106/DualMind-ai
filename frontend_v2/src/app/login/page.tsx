'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'beta' | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/chat');
    }
  }, [status, router]);

  const handleSignIn = async (provider: 'google' | 'github') => {
    if (loadingProvider) return;
    setLoadingProvider(provider);

    // Clear any local storage static session state
    localStorage.removeItem('dualmind_logged_in');
    localStorage.removeItem('dualmind_logged_in_provider');
    localStorage.removeItem('dualmind_static_user');

    try {
      // Sign out from any previous sessions first to guarantee account picker is shown
      await signOut({ redirect: false });
      
      // Perform dynamic auth redirection to official provider screen
      await signIn(provider, { callbackUrl: '/chat' });
    } catch (error) {
      console.error('Authentication request failed', error);
      setLoadingProvider(null);
    }
  };

  const handleBetaTesterSignIn = () => {
    if (loadingProvider) return;
    setLoadingProvider('beta');

    // Set offline static Beta Tester credentials
    localStorage.setItem('dualmind_logged_in', 'true');
    localStorage.setItem('dualmind_logged_in_provider', 'beta');
    localStorage.setItem('dualmind_static_user', JSON.stringify({
      id: "dualmind_static_user",
      name: "Beta Tester",
      email: "tester@dualmind.ai",
      image: null
    }));

    // Redirect directly to chat workspace
    window.location.href = '/chat';
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050B14]">
        <BrainCircuit className="w-12 h-12 text-accent-cyan/40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050B14] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent-cyan/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-accent-purple/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-panel border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 mb-4 shadow-[0_0_30px_rgba(0,229,255,0.15)] animate-pulse">
              <BrainCircuit className="w-8 h-8 text-accent-cyan" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">DualMind OS</h1>
            <p className="text-sm text-foreground-muted mt-2">Sign in to access the AI Operating System</p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleSignIn('google')}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="w-5 h-5 text-black animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              onClick={() => handleSignIn('github')}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-[#24292e] text-white font-semibold text-sm hover:bg-[#2f363d] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg border border-white/10 disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none"
            >
              {loadingProvider === 'github' ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              )}
              Continue with GitHub
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-[1px] flex-1 bg-white/5" />
              <span className="text-[10px] text-foreground-muted/40 font-mono tracking-widest uppercase">or</span>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>

            {/* Beta Tester secondary entry point */}
            <button
              onClick={handleBetaTesterSignIn}
              disabled={loadingProvider !== null}
              className="w-full py-2.5 rounded-xl border border-white/5 bg-white/5 text-foreground-muted text-xs font-semibold hover:bg-white/10 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loadingProvider === 'beta' && <Loader2 className="w-4 h-4 text-foreground-muted animate-spin" />}
              Continue as Beta Tester
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[10px] text-foreground-muted/50 font-mono tracking-wider uppercase">
              Autonomous Intelligence Platform · v3.1
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
