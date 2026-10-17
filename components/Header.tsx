'use client';

import { LogOut, Moon, RefreshCw, Sun, Settings, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/authContext';

export default function Header({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { isDark, toggle } = useTheme();
  const { signOut } = useAuth();

  async function handleLogout() {
    try {
      await signOut();
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  async function handleRefresh() {
    if (onRefresh) {
      setLoading(true);
      await onRefresh();
      setLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-xs transition-colors">
      <div className="flex items-center gap-2.5">
        <Logo className="w-9 h-9 shadow-xs rounded-2xl" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{title}</h1>
          <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold tracking-wide">Keo Family</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl hover:bg-orange-50 dark:hover:bg-slate-800 transition"
            title="Synchroniser"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>
        )}
        <button
          onClick={toggle}
          className={`p-2 rounded-xl transition flex items-center gap-1.5 font-medium text-xs ${
            isDark
              ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/30'
              : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-primary-600 border border-gray-200'
          }`}
          title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          <span className="hidden sm:inline">{isDark ? 'Clair' : 'Sombre'}</span>
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('dar:open-chatbot'));
            }
          }}
          className="p-2 text-primary-600 dark:text-amber-400 hover:text-primary-700 dark:hover:text-amber-300 rounded-xl hover:bg-orange-50 dark:hover:bg-slate-800 transition"
          title="Assistant Support Keo (Chatbot)"
          aria-label="Assistant Support Keo"
        >
          <Bot className="w-5 h-5" />
        </button>
        <Link
          href="/settings"
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl hover:bg-orange-50 dark:hover:bg-slate-800 transition"
          title="Paramètres & Apparence"
        >
          <Settings className="w-5 h-5" />
        </Link>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
