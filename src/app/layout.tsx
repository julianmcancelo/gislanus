import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { AuthProvider } from "@/context/AuthContext";
import PendingBlocker from "@/components/PendingBlocker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GIS Portal",
  description: "Sistema de Información Geográfica",
  icons: {
    icon: "/favicon.ico",
  },
};

import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <PendingBlocker>
            {children}
            <Toaster 
              position="top-center" 
              toastOptions={{ 
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  borderRadius: '12px',
                }
              }} 
            />
          </PendingBlocker>
        </AuthProvider>
      </body>
    </html>
  );
}
