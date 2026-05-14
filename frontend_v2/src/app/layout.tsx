import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DualMind — AI Operating System",
  description: "A realtime AI Operating System with cinematic multi-agent orchestration. Plan. Research. Verify. Synthesize.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "DualMind — AI Operating System",
    description: "A realtime AI Operating System with cinematic multi-agent orchestration.",
    url: "https://dualmind-ai.web.app",
    siteName: "DualMind",
    type: "website",
  },
  metadataBase: new URL("https://dualmind-ai.web.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-accent-cyan/30 selection:text-white">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
