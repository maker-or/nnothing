import type { Metadata } from "next";
import { Geist, Geist_Mono,Instrument_Serif } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from '../components/ConvexClientProvider';
import { PHProvider } from './providers';
import PostHogPageView from './PostHogPageView';
import { Suspense } from 'react';
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  weight: ['400'],
   style: 'italic',
  subsets: ['latin'],
  variable: '--font-serif',

})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sphereai.in",
  description: "New Knowledge layer for your collage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} antialiased`}
      >
        <PHProvider>
          <ClerkProvider>
            <ConvexClientProvider>
              <Suspense>
                <PostHogPageView />
              </Suspense>
              {children}
            </ConvexClientProvider>
          </ClerkProvider>
        </PHProvider>
      </body>
    </html>
  );
}
