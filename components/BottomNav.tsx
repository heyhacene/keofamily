'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Calendar, CheckSquare, Utensils, Users } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  const links = [
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageSquare,
      isActive: pathname.startsWith('/messages'),
    },
    {
      href: '/agenda',
      label: 'Agenda',
      icon: Calendar,
      isActive: pathname.startsWith('/agenda'),
    },
    {
      href: '/taches',
      label: 'Tâches',
      icon: CheckSquare,
      isActive: pathname.startsWith('/taches'),
    },
    {
      href: '/planning',
      label: 'Repas',
      icon: Utensils,
      isActive:
        pathname.startsWith('/planning') ||
        pathname.startsWith('/recettes') ||
        pathname.startsWith('/courses'),
    },
    {
      href: '/famille',
      label: 'Famille',
      icon: Users,
      isActive: pathname.startsWith('/famille') || pathname.startsWith('/settings'),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 pb-safe transition-colors">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-1">
        {links.map(({ href, label, icon: Icon, isActive }) => {
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400 font-bold'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition ${
                  isActive ? 'bg-primary-50 dark:bg-primary-950/50' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className="text-[10px] sm:text-[11px] mt-0.5 tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
