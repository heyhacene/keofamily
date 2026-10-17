'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import AddMealModal from '@/components/AddMealModal';
import { AppData, DayOfWeek, MealType, PlannedMeal, WeekSelection } from '@/types';
import { loadLocalData, loadCloudData, syncKitchenCloud } from '@/lib/storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Plus, Users, Trash2, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import CuisineTabs from '@/components/CuisineTabs';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

export default function PlanningPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [activeWeek, setActiveWeek] = useState<WeekSelection>('s1');
  const [modalSlot, setModalSlot] = useState<{ day: DayOfWeek; type: MealType } | null>(null);

  useEffect(() => {
    // 1. Rendu immédiat depuis le cache local
    const local = loadLocalData();
    setData(local);

    // 2. Chargement depuis le cloud Supabase
    loadCloudData().then((cloudData) => {
      setData(cloudData);
    });

    // 3. Écoute temps réel pour synchroniser le planning familial en direct
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('planning_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_kitchen' },
          () => {
            loadCloudData().then((fresh) => setData(fresh));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-500">Chargement du planning...</div>;

  const handleOpenSlot = (day: DayOfWeek, type: MealType) => {
    setModalSlot({ day, type });
  };

  const getMealKey = (week: WeekSelection, day: DayOfWeek, type: MealType) => `${week}_${day}_${type}`;

  const getMeal = (week: WeekSelection, day: DayOfWeek, type: MealType): PlannedMeal | undefined => {
    const key = getMealKey(week, day, type);
    if (data.weeklyPlan[key]) return data.weeklyPlan[key];
    // Rétrocompatibilité avec les repas sans préfixe de semaine
    if (week === 's1' && data.weeklyPlan[`${day}_${type}`]) {
      return data.weeklyPlan[`${day}_${type}`];
    }
    return undefined;
  };

  const handleSaveMeal = (mealInfo: { recipeId?: string; customTitle?: string; servings: number }) => {
    if (!modalSlot) return;
    const key = getMealKey(activeWeek, modalSlot.day, modalSlot.type);
    const newMeal: PlannedMeal = {
      id: `p_${Date.now()}`,
      week: activeWeek,
      day: modalSlot.day,
      type: modalSlot.type,
      ...mealInfo,
    };

    const updated: AppData = {
      ...data,
      weeklyPlan: {
        ...data.weeklyPlan,
        [key]: newMeal,
      },
    };
    setData(updated);
    syncKitchenCloud(updated.weeklyPlan, updated.customShoppingItems, updated.checkedItems);
    setModalSlot(null);
  };

  const handleDirectDelete = (day: DayOfWeek, type: MealType) => {
    const key = getMealKey(activeWeek, day, type);
    const copy = { ...data.weeklyPlan };
    delete copy[key];
    if (activeWeek === 's1') {
      delete copy[`${day}_${type}`];
    }

    const updated: AppData = { ...data, weeklyPlan: copy };
    setData(updated);
    syncKitchenCloud(updated.weeklyPlan, updated.customShoppingItems, updated.checkedItems);
  };

  const handleDeleteMeal = () => {
    if (!modalSlot) return;
    handleDirectDelete(modalSlot.day, modalSlot.type);
    setModalSlot(null);
  };

  const handleClearWeek = () => {
    const weekTitle = activeWeek === 's1' ? 'cette semaine' : 'la semaine prochaine';
    if (!confirm(`Voulez-vous vider tous les repas pour ${weekTitle} ?`)) return;
    const copy = { ...data.weeklyPlan };
    Object.keys(copy).forEach((k) => {
      if (k.startsWith(`${activeWeek}_`) || (activeWeek === 's1' && !k.startsWith('s1_') && !k.startsWith('s2_'))) {
        delete copy[k];
      }
    });

    const updated: AppData = { ...data, weeklyPlan: copy };
    setData(updated);
    syncKitchenCloud(updated.weeklyPlan, updated.customShoppingItems, updated.checkedItems);
  };

  // Calcul du nombre de repas sur la semaine active
  const weekMealsCount = DAYS.reduce((count, day) => {
    const lunch = getMeal(activeWeek, day.key, 'midi');
    const dinner = getMeal(activeWeek, day.key, 'soir');
    return count + (lunch ? 1 : 0) + (dinner ? 1 : 0);
  }, 0);

  return (
    <div className="pb-32">
      <Header title="Planning des repas" onRefresh={() => loadCloudData().then(setData)} />
      <CuisineTabs />

      <div className="p-4 space-y-4">
        {/* SÉLECTEUR 2 SEMAINES */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl text-xs font-bold shadow-xs">
          <button
            type="button"
            onClick={() => setActiveWeek('s1')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeWeek === 's1'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${activeWeek === 's1' ? 'text-primary-600' : 'text-gray-400'}`} />
            <span>Cette semaine</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWeek('s2')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeWeek === 's2'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${activeWeek === 's2' ? 'text-primary-600' : 'text-gray-400'}`} />
            <span>Semaine prochaine</span>
          </button>
        </div>

        {/* Bannière résumé & actions */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">
              {activeWeek === 's1' ? 'Menu de cette semaine' : 'Menu de la semaine prochaine'}
            </h2>
            <p className="text-xs text-orange-100">
              {weekMealsCount > 0 ? `${weekMealsCount} repas programmé(s)` : 'Aucun repas programmé'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {weekMealsCount > 0 && (
              <button
                onClick={handleClearWeek}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl text-xs backdrop-blur-md transition flex items-center gap-1"
                title="Vider cette semaine"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            )}
            <Link
              href="/courses"
              className="px-3.5 py-1.5 bg-white text-primary-600 font-bold rounded-xl text-xs shadow-sm hover:bg-orange-50 transition"
            >
              Courses →
            </Link>
          </div>
        </div>

        {/* Grille du Lundi au Dimanche */}
        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const lunch = getMeal(activeWeek, key, 'midi');
            const dinner = getMeal(activeWeek, key, 'soir');
            const lunchRecipe = lunch?.recipeId ? data.recipes.find((r) => r.id === lunch.recipeId) : null;
            const dinnerRecipe = dinner?.recipeId ? data.recipes.find((r) => r.id === dinner.recipeId) : null;

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="bg-gray-50/80 px-4 py-2 border-b border-gray-100 font-bold text-sm text-gray-800 flex items-center justify-between">
                  <span>{label}</span>
                  {(lunch || dinner) && (
                    <span className="text-[11px] font-normal text-gray-500">
                      {[lunch && 'Midi', dinner && 'Soir'].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-100 text-sm">
                  {/* Créneau MIDI */}
                  <div
                    onClick={() => handleOpenSlot(key, 'midi')}
                    className="p-3 hover:bg-orange-50/30 transition cursor-pointer flex flex-col justify-between min-h-[95px] relative group"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                      <span>Midi ☀️</span>
                      {lunch && (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5 text-primary-600 font-semibold">
                            <Users className="w-3 h-3" /> {lunch.servings}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDelete(key, 'midi');
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5 transition"
                            title="Supprimer ce repas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {lunch ? (
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-2 text-xs">
                          {lunchRecipe ? lunchRecipe.title : lunch.customTitle}
                        </p>
                        <span className="text-[10px] text-primary-600/80 font-medium">
                          {lunchRecipe ? 'Recette du carnet' : 'Plat libre'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-300 text-xs py-2">
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </div>
                    )}
                  </div>

                  {/* Créneau SOIR */}
                  <div
                    onClick={() => handleOpenSlot(key, 'soir')}
                    className="p-3 hover:bg-orange-50/30 transition cursor-pointer flex flex-col justify-between min-h-[95px] relative group"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                      <span>Soir 🌙</span>
                      {dinner && (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5 text-primary-600 font-semibold">
                            <Users className="w-3 h-3" /> {dinner.servings}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDelete(key, 'soir');
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5 transition"
                            title="Supprimer ce repas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {dinner ? (
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-2 text-xs">
                          {dinnerRecipe ? dinnerRecipe.title : dinner.customTitle}
                        </p>
                        <span className="text-[10px] text-primary-600/80 font-medium">
                          {dinnerRecipe ? 'Recette du carnet' : 'Plat libre'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-300 text-xs py-2">
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalSlot && (
        <AddMealModal
          day={modalSlot.day}
          type={modalSlot.type}
          recipes={data.recipes}
          initialMeal={getMeal(activeWeek, modalSlot.day, modalSlot.type)}
          onClose={() => setModalSlot(null)}
          onSave={handleSaveMeal}
          onDelete={getMeal(activeWeek, modalSlot.day, modalSlot.type) ? handleDeleteMeal : undefined}
        />
      )}
    </div>
  );
}
