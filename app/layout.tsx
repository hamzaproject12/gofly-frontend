import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthNav from './components/AuthNav'
import ProtectedRoute from './components/ProtectedRoute'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GoodFly - Gestion Caisse',
  description: 'Application de gestion de caisse pour les voyages Omra',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <AuthNav />
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </body>
    </html>
  )
}
