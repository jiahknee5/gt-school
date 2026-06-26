import type { Metadata } from 'next';
import { Literata, Inter, Inconsolata } from 'next/font/google';
import './globals.css';

const literata = Literata({ subsets: ['latin'], variable: '--font-literata', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const inconsolata = Inconsolata({ subsets: ['latin'], variable: '--font-inconsolata', display: 'swap' });

export const metadata: Metadata = {
  title: 'GT Marketing Hub',
  description: 'Centralized marketing command center for GT Anywhere.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${inter.variable} ${inconsolata.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
