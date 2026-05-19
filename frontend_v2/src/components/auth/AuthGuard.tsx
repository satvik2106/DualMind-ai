'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BrainCircuit } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const isBetaUser = typeof window !== 'undefined' && localStorage.getItem('dualmind_logged_in') === 'true';
    if (status === 'unauthenticated' && !isBetaUser) {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center">
        <div className="relative">
          <BrainCircuit className="w-16 h-16 text-accent-cyan/40 animate-pulse" />
          <div className="absolute inset-0 bg-accent-cyan/10 blur-2xl rounded-full" />
        </div>
        <p className="mt-6 text-sm text-foreground-muted font-mono tracking-widest uppercase">
          Initializing Neural Link...
        </p>
      </div>
    );
  }

  const isBetaUser = typeof window !== 'undefined' && localStorage.getItem('dualmind_logged_in') === 'true';
  if (status === 'authenticated' || isBetaUser) {
    return <>{children}</>;
  }

  return null;
}
