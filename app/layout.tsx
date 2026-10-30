import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ConfirmDialogHost } from '@/components/confirm-dialog'
import { SyncStatus } from '@/components/sync-status'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif'
})

export const metadata: Metadata = {
  title: 'RecruiterOS: your company’s talent pool',
  description:
    'Campus drives, careers-page applicants and every resume you have ever received, in one searchable talent pool with explainable role matching.'
}

export const viewport: Viewport = {
  themeColor: '#f8f7f4'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <SyncStatus />
        <ConfirmDialogHost />
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}
