'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('keofamily_local_profile') : null;
    if (saved) {
      router.replace('/taches');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-gray-400">
      Chargement de Keo Family...
    </div>
  );
}
