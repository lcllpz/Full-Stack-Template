import { Geist } from 'next/font/google';

import { cn } from '@/lib/utils';
import { QueryProvider } from '@/services';

import '@/styles/globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('h-full', 'antialiased', 'font-sans', geist.variable)}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
