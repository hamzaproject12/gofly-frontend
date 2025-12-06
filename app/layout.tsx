import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ConditionalLayout from './components/ConditionalLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  // 1. Le Titre (Nom dans l'onglet)
  title: process.env.NEXT_PUBLIC_APP_NAME || 'GoFly App',
  
  // 2. La Description (pour Google/SEO)
  description: 'Application de gestion pour agence de voyage Omra',

  // 3. Le Logo (Favicon)
  icons: {
    icon: process.env.NEXT_PUBLIC_APP_LOGO || '/favicon.ico', // Chemin vers l'image dans public/
    apple: process.env.NEXT_PUBLIC_APP_LOGO || '/favicon.ico', // Pour les iPhones
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className} suppressHydrationWarning>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  )
}
