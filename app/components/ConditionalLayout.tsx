'use client';

import { usePathname } from 'next/navigation';
import AuthNav from './AuthNav';
import ProtectedRoute from './ProtectedRoute';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  
  // Pages qui n'ont pas besoin de navbar
  const publicPages = ['/login', '/register'];
  const isPublicPage = publicPages.includes(pathname);

  if (isPublicPage) {
    // Pour les pages publiques, pas de navbar ni de protection
    return <>{children}</>;
  }

  // Pour toutes les autres pages, navbar fixe + protection
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar fixe */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <AuthNav />
      </div>
      
      {/* Contenu avec padding pour la navbar */}
      <div className="pt-14">
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </div>
    </div>
  );
}
