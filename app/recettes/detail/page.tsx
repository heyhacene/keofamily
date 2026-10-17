'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Recipe, ShoppingItem, Ingredient } from '@/types';
import { loadLocalData, loadCloudData, deleteCloudRecipe, syncKitchenCloud } from '@/lib/storage';
import { ArrowLeft, Users, Clock, Flame, Trash2, ShoppingCart, Plus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState<number>(4);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  useEffect(() => {
    const queryId =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;
    const recipeId = queryId || (Array.isArray(params?.id) ? params.id[0] : params?.id);
    if (!recipeId) return;

    // 1. Chercher dans le cache local
    const data = loadLocalData();
    const found = data.recipes.find((r) => r.id === recipeId);
    if (found) {
      setRecipe(found);
      setServings(found.defaultServings);
    }

    // 2. Synchroniser avec Supabase au cas où la recette a été créée depuis un autre appareil
    loadCloudData().then((cloudData) => {
      const cloudFound = cloudData.recipes.find((r) => r.id === recipeId);
      if (cloudFound) {
        setRecipe(cloudFound);
        setServings(cloudFound.defaultServings);
      }
    });
  }, [params]);

  if (!recipe) {
    return <div className="p-8 text-center text-gray-500">Recette introuvable...</div>;
  }

  // Calculateur de proportion dynamique selon le nombre de convives
  const scale = servings / recipe.defaultServings;

  async function handleDelete() {
    if (!confirm('Supprimer cette recette du carnet pour toute la famille ?')) return;
    await deleteCloudRecipe(recipe!.id);
    router.push('/recettes');
  }

  // AJOUT EN 1 CLIC DE TOUS LES INGRÉDIENTS À LA LISTE DE COURSES
  async function handleAddAllToShoppingList() {
    if (!recipe) return;
    const data = loadLocalData();

    const newItems: ShoppingItem[] = recipe.ingredients.map((ing) => ({
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${ing.name} (${recipe.title})`,
      quantity: Math.round(ing.quantity * scale * 10) / 10,
      unit: ing.unit,
      category: ing.category || 'epicerie',
      checked: false,
      isCustom: true,
    }));

    const updatedCustom = [...newItems, ...data.customShoppingItems];
    await syncKitchenCloud(data.weeklyPlan, updatedCustom, data.checkedItems);

    setAddedNotice(`${newItems.length} ingrédients ajoutés à votre liste de courses !`);
    setTimeout(() => setAddedNotice(null), 4000);
  }

  // AJOUT D'UN SEUL INGRÉDIENT AU CHOIX
  async function handleAddSingleIngredient(ing: Ingredient) {
    if (!recipe) return;
    const data = loadLocalData();
    const adjustedQuantity = Math.round(ing.quantity * scale * 10) / 10;

    const newItem: ShoppingItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${ing.name} (${recipe.title})`,
      quantity: adjustedQuantity,
      unit: ing.unit,
      category: ing.category || 'epicerie',
      checked: false,
      isCustom: true,
    };

    const updatedCustom = [newItem, ...data.customShoppingItems];
    await syncKitchenCloud(data.weeklyPlan, updatedCustom, data.checkedItems);

    setAddedNotice(`« ${ing.name} » ajouté aux courses !`);
    setTimeout(() => setAddedNotice(null), 3000);
  }

  return (
    <div className="pb-10">
      <div className="relative h-64 bg-gray-900">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover opacity-85" />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-primary-600 to-amber-500 flex items-center justify-center text-white" />
        )}

        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/recettes"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleDelete}
            className="w-10 h-10 rounded-full bg-red-600/80 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-700 transition"
            title="Supprimer"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/80 to-transparent text-white">
          <span className="text-xs uppercase font-bold tracking-wider text-orange-300 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full">
            {recipe.category}
          </span>
          <h1 className="text-xl font-bold mt-1.5 leading-snug">{recipe.title}</h1>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Notification après ajout aux courses */}
        {addedNotice && (
          <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in slide-in-from-top">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{addedNotice}</span>
            </div>
            <Link
              href="/courses"
              className="px-2.5 py-1 bg-white text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-50 transition"
            >
              Voir la liste →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50/70 p-3 rounded-2xl border border-orange-100 flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-[11px] text-gray-500">Préparation</p>
              <p className="font-bold text-sm text-gray-900">{recipe.prepTimeMinutes} min</p>
            </div>
          </div>
          <div className="bg-orange-50/70 p-3 rounded-2xl border border-orange-100 flex items-center gap-3">
            <Flame className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-[11px] text-gray-500">Cuisson</p>
              <p className="font-bold text-sm text-gray-900">{recipe.cookTimeMinutes} min</p>
            </div>
          </div>
        </div>

        {/* CALCULATEUR DE PROPORTIONS SELON LE NOMBRE DE PERSONNES */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              <span className="font-bold text-sm text-gray-900">Ajuster les portions</span>
            </div>
            <div className="flex items-center gap-3 bg-gray-100 px-3 py-1.5 rounded-xl">
              <button
                onClick={() => setServings(Math.max(1, servings - 1))}
                className="font-black text-gray-600 hover:text-gray-900 text-base"
              >
                -
              </button>
              <span className="font-bold text-primary-600 text-sm w-12 text-center">
                {servings} pers.
              </span>
              <button
                onClick={() => setServings(servings + 1)}
                className="font-black text-gray-600 hover:text-gray-900 text-base"
              >
                +
              </button>
            </div>
          </div>

          {/* BOUTON D'AJOUT EN 1 CLIC */}
          <button
            onClick={handleAddAllToShoppingList}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ajouter tous les ingrédients à ma liste de courses</span>
          </button>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Ingrédients proportionnés :</h3>
            <span className="text-[11px] text-gray-400">Cliquez sur « + » pour un seul ingrédient</span>
          </div>

          <ul className="divide-y divide-gray-100 text-sm">
            {recipe.ingredients.map((ing) => {
              const adjustedQuantity = Math.round(ing.quantity * scale * 10) / 10;
              return (
                <li key={ing.id} className="py-2.5 flex justify-between items-center group">
                  <span className="text-gray-800 font-medium text-xs sm:text-sm">{ing.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-600 text-xs bg-orange-50 px-2 py-1 rounded-md">
                      {adjustedQuantity} {ing.unit}
                    </span>
                    <button
                      onClick={() => handleAddSingleIngredient(ing)}
                      className="p-1 rounded-md text-gray-400 hover:text-primary-600 hover:bg-orange-50 transition"
                      title="Ajouter cet ingrédient uniquement aux courses"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Étapes */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <h3 className="font-bold text-gray-900 text-sm">Étapes de préparation</h3>
          <div className="space-y-3">
            {recipe.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-gray-700 leading-relaxed flex-1">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {recipe.notes && (
          <div className="p-3.5 bg-yellow-50 rounded-xl border border-yellow-200 text-xs text-yellow-800">
            <strong>Note :</strong> {recipe.notes}
          </div>
        )}
      </div>
    </div>
  );
}
