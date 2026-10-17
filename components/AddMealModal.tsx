'use client';

import { useState } from 'react';
import { Recipe, DayOfWeek, MealType, PlannedMeal } from '@/types';
import { X, Search, Users, Trash2 } from 'lucide-react';

interface Props {
  day: DayOfWeek;
  type: MealType;
  recipes: Recipe[];
  initialMeal?: PlannedMeal;
  onClose: () => void;
  onSave: (meal: { recipeId?: string; customTitle?: string; servings: number }) => void;
  onDelete?: () => void;
}

export default function AddMealModal({
  day,
  type,
  recipes,
  initialMeal,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<'recette' | 'libre'>(
    initialMeal?.customTitle ? 'libre' : 'recette'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    initialMeal?.recipeId || recipes[0]?.id || ''
  );
  const [customTitle, setCustomTitle] = useState(initialMeal?.customTitle || '');
  const [servings, setServings] = useState<number>(initialMeal?.servings || 4);

  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
  const typeLabel = type === 'midi' ? 'Midi ☀️' : 'Soir 🌙';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'recette') {
      onSave({ recipeId: selectedRecipeId, servings });
    } else {
      if (!customTitle.trim()) return;
      onSave({ customTitle: customTitle.trim(), servings });
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              {initialMeal ? 'Modifier le repas' : `Repas de ${dayLabel}`}
            </h3>
            <p className="text-xs text-primary-600 font-medium">{dayLabel} • {typeLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-sm font-medium">
            <button
              type="button"
              onClick={() => setTab('recette')}
              className={`py-2 rounded-lg transition ${tab === 'recette' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Choisir une recette
            </button>
            <button
              type="button"
              onClick={() => setTab('libre')}
              className={`py-2 rounded-lg transition ${tab === 'libre' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'}`}
            >
              Plat libre / Restes
            </button>
          </div>

          <div className="bg-orange-50/60 p-3.5 rounded-xl border border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Users className="w-4 h-4 text-primary-600" />
              <span>Nombre de personnes :</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setServings(Math.max(1, servings - 1))}
                className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50"
              >
                -
              </button>
              <span className="font-bold text-gray-900 w-6 text-center">{servings}</span>
              <button
                type="button"
                onClick={() => setServings(servings + 1)}
                className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {tab === 'recette' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une recette..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {filteredRecipes.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      selectedRecipeId === r.id
                        ? 'border-primary-500 bg-primary-50/30 ring-1 ring-primary-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="recipe"
                      value={r.id}
                      checked={selectedRecipeId === r.id}
                      onChange={() => setSelectedRecipeId(r.id)}
                      className="hidden"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">
                        {r.prepTimeMinutes + r.cookTimeMinutes} min • {r.ingredients.length} ingrédients
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Titre du repas ou note
              </label>
              <input
                type="text"
                placeholder="Ex: Restes de la veille, Pizza maison, Resto..."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                required
              />
            </div>
          )}
          </div>

          <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3.5 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-xs font-bold transition flex items-center gap-1.5"
                title="Supprimer ce repas"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer</span>
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs shadow-md transition text-center"
            >
              {initialMeal ? 'Mettre à jour' : 'Enregistrer au planning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
