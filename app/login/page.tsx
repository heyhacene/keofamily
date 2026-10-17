'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  Home,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { Profile } from '@/lib/supabase';
import { useAuth, LOCAL_PROFILE_STORAGE_KEY, LOCAL_MEMBERS_STORAGE_KEY } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile, user, isApproved } = useAuth();
  const { isDark, toggle } = useTheme();
  const [fullName, setFullName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isApproved) {
      router.push('/taches');
    }
  }, [user, isApproved, router]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = fullName.trim() || 'Membre Famille';
    setLoading(true);

    const newProfile: Profile = {
      id: 'local-admin-1',
      email: 'foyer@keofamily.local',
      full_name: cleanName,
      role: 'admin',
      status: 'approved',
      avatar_url: '🏠',
      created_at: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
      if (familyName.trim()) {
        localStorage.setItem('keofamily_household_name', familyName.trim());
      }
      const existingMembersRaw = localStorage.getItem(LOCAL_MEMBERS_STORAGE_KEY);
      if (!existingMembersRaw) {
        localStorage.setItem(LOCAL_MEMBERS_STORAGE_KEY, JSON.stringify([newProfile]));
      }
    }

    await refreshProfile();
    router.push('/taches');
  }

  return (
    <div className="min-h-screen flex flex-col justify-center p-5 bg-gradient-to-br from-orange-50 via-amber-50/40 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative transition-colors">
      {/* BOUTON THÈME CLAIR / SOMBRE */}
      <button
        type="button"
        onClick={toggle}
        className="absolute top-5 right-5 p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 shadow-sm text-gray-700 dark:text-amber-300 flex items-center gap-1.5 text-xs font-semibold transition"
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        <span>{isDark ? 'Clair' : 'Sombre'}</span>
      </button>

      <div className="max-w-sm w-full mx-auto space-y-6">
        {/* LOGO ET TITRE */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-2 bg-white dark:bg-slate-800 rounded-3xl shadow-lg shadow-orange-500/10 border border-orange-100 dark:border-slate-700 mb-1">
            <Logo className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Keo Family
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            L’application tout-en-un pour organiser la vie de votre foyer : Tâches, Courses, Recettes, Planning & Agenda.
          </p>
        </div>

        {/* CARTE PRINCIPALE */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-slate-700">
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-primary-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">
                Bienvenue dans votre espace
              </h2>
              <p className="text-[11px] text-gray-400">
                Configuration rapide en 10 secondes
              </p>
            </div>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Votre Prénom (ou Pseudo)
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Sarah, Thomas, Maman..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Nom de votre foyer (optionnel)
              </label>
              <div className="relative">
                <Home className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Ex: Famille Martin, Notre Maison..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>100% privé & autonome :</strong> vos données sont stockées directement sur votre appareil. Vous pourrez ajouter les autres membres du foyer dans l’onglet <em>Famille</em>.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <span>{loading ? 'Ouverture...' : 'Entrer dans Keo Family'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* NOTE DE BAS DE PAGE */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 text-center">
            <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-500" />
              <span>Suite Keo — Application familiale autonome</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
