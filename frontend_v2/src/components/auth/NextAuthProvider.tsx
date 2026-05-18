'use client'
import { SessionProvider } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { BrainCircuit } from 'lucide-react'

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  const [staticSession, setStaticSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('dualmind_logged_in') === 'true';
    if (isLoggedIn) {
      const storedUser = localStorage.getItem('dualmind_static_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setStaticSession({
            user: parsedUser,
            expires: "2030-01-01T00:00:00.000Z"
          });
        } catch (e) {
          // ignore
        }
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center">
        <BrainCircuit className="w-12 h-12 text-accent-cyan/40 animate-pulse" />
      </div>
    );
  }

  return (
    <SessionProvider session={staticSession || undefined}>
      {children}
    </SessionProvider>
  );
}
