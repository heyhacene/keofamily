'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, BookOpen, ShoppingCart } from 'lucide-react';

export default function CuisineTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: '/planning', label: 'Planning', icon: CalendarDays },
    { href: '/recettes', label: 'Recettes', icon: BookOpen },
    { href: '/courses', label: 'Courses', icon: ShoppingCart },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-750 px-4 py-2 sticky top-0 z-30 shadow-xs">
      <div className="flex bg-gray-100/80 dark:bg-slate-700/80 p-1 rounded-xl max-w-md mx-auto">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/planning' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
