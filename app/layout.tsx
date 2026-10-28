import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'DailyDrop — tech news, edited for one reader',
  description: 'An AI editor that reads the tech internet every morning and writes a digest just for you.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Daily<span className="text-brand">Drop</span>
          </Link>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-24">{children}</main>
      </body>
    </html>
  )
}
