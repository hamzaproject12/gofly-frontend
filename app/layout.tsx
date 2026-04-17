import { siteConfig } from '@/lib/config';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ConditionalLayout from './components/ConditionalLayout'
import { UnsavedChangesProvider } from './components/UnsavedChangesProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: siteConfig.logo,
    apple: siteConfig.logo,
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
        <UnsavedChangesProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </UnsavedChangesProvider>
      </body>
    </html>
  )
}
