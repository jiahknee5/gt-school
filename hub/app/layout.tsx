import type { Metadata } from "next";
import { Inconsolata, Inter_Tight, Literata } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";
import { TourProvider } from "./_components/GuidedTour";
import { DEV_MODE, getSession } from "@/lib/auth";
import { getNavScopeForUser } from "@/lib/nav-preference";

// gt.school body face is Inter Tight (Webflow --font-family--body). Kept under the
// existing --font-inter variable so globals.css / every component stays untouched.
const inter = Inter_Tight({
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const navScope = session ? await getNavScopeForUser(session.id) : "my";
  const viewer = session
    ? {
        id: session.id,
        name: session.name,
        title: session.title,
        role: session.role,
        functionalRoles: session.functionalRoles,
        ownsModules: session.ownsModules,
      }
    : null;

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${inconsolata.variable} ${literata.variable}`}
      >
        <TourProvider>
          <div className="flex min-h-screen bg-canvas">
            <Suspense fallback={null}>
              <Sidebar viewer={viewer} devMode={DEV_MODE} navScope={navScope} />
            </Suspense>
            <div className="min-w-0 flex-1">
              <Suspense fallback={null}>
                <TopBar viewer={viewer} devMode={DEV_MODE} navScope={navScope} />
              </Suspense>
              {children}
            </div>
          </div>
        </TourProvider>
      </body>
    </html>
  );
}
