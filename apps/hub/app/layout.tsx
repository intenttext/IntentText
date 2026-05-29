import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "IntentText Hub",
  description:
    "The registry for .it templates — browse agent definitions, workflow patterns, and document templates.",
  openGraph: {
    title: "IntentText Hub",
    description:
      "The registry for .it templates — browse agent definitions, workflow patterns, and document templates.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://intenttext-hub.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
