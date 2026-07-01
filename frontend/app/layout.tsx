import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { SyncStarter } from "@/lib/hooks/useSync";
import { DeviceSessionStarter } from "@/lib/hooks/useDeviceSession";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MargoPro",
  description: "Gérez votre commerce simplement",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MargoPro",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4601A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${manrope.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        {/* Init theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('margopro-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body style={{ minHeight: '100%', background: 'var(--background)', color: 'var(--foreground)' }}>
        <SyncStarter />
        <DeviceSessionStarter />
        <main style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }}>
          {children}
          <BottomNav />
        </main>
      </body>
    </html>
  );
}
