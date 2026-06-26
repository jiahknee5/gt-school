import type { Metadata } from "next";
import { Inconsolata, Inter, Literata } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inconsolata",
  display: "swap",
});

// GT "Analog Futurism" serif — kept as a sparing accent only.
const literata = Literata({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GT Marketing Hub",
  description:
    "Centralized marketing operations workspace for GT Anywhere — grassroots, content, nurture, ops, events, admissions, and summer camp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${inconsolata.variable} ${literata.variable}`}
      >
        <div className="flex min-h-screen bg-canvas">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <TopBar />
            </Suspense>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
