'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { AppData, ShoppingItem } from '@/types';
import { loadLocalData, loadCloudData, syncKitchenCloud, flushKitchenOfflineQueue } from '@/lib/storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Check,
  Plus,
  ShoppingBag,
  Trash2,
  Info,
  Share2,
  Copy,
  CheckCheck,
  ShoppingCart,
  LayoutGrid,
  List,
  Sparkles,
  MessageCircle,
  X,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import CuisineTabs from '@/components/CuisineTabs';

// Préfixe des clés de `checkedItems` marquant un ingrédient du planning retiré de la liste
const HIDDEN_PREFIX = 'hidden_';

const CATEGORY_METADATA: Record<string, { label: string; icon: string; order: number }> = {
  fruits_legumes: { label: 'Fruits & Légumes', icon: '🥬', order: 1 },
  frais_cremerie: { label: 'Frais & Crèmerie', icon: '🥛', order: 2 },
  viandes_poissons: { label: 'Boucherie & Poissonnerie', icon: '🥩', order: 3 },
  boulangerie: { label: 'Boulangerie & Pâtisserie', icon: '🥖', order: 4 },
  epicerie: { label: 'Épicerie & Condiments', icon: '🍝', order: 5 },
  boissons: { label: 'Boissons & Petit déjeuner', icon: '🧃', order: 6 },
  hygiene: { label: 'Hygiène & Entretien', icon: '🧼', order: 7 },
  autres: { label: 'Autres rayons', icon: '📦', order: 8 },
};

function autoDetectCategory(name?: string): string {
  if (!name) return 'epicerie';
  const n = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/pomme|poire|banane|orange|citron|fraise|tomate|carotte|salade|courgette|oignon|echalote|ail|avocat|poireau|pomme de terre|champignon|concombre|poivron|haricot|herbe|persil|coriandre|basilic|epinard|legume|fruit|radis|chou|melon|pasteque|peche|abricot/i.test(n)) {
    return 'fruits_legumes';
  }
  if (/lait|beurre|creme|yaourt|fromage|gruyere|parmesan|mozzarella|creme fraiche|emmental|oeuf|comte|chevre|feta|ricotta|mascarpone/i.test(n)) {
    return 'frais_cremerie';
  }
  if (/poulet|boeuf|porc|veau|steak|viande|saumon|cabillaud|thon|crevette|jambon|dinde|lard|saucisse|poisson|bifteck|hache|escalope|merguez|chipolata/i.test(n)) {
    return 'viandes_poissons';
  }
  if (/pain|baguette|croissant|brioche|mie|biscotte|patisserie|pain au chocolat/i.test(n)) {
    return 'boulangerie';
  }
  if (/eau|jus|coca|soda|biere|vin|cafe|the|sirop|boisson|limonade|cidre/i.test(n)) {
    return 'boissons';
  }
  if (/savon|dentifrice|shampoing|gel douche|lessive|eponge|sopalin|papier toilette|vaisselle|poubelle|nettoyant|javel|coton|shampooing|adoucissant/i.test(n)) {
    return 'hygiene';
  }
  return 'epicerie';
}

export default function CoursesPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('auto');
  const [weekFilter, setWeekFilter] = useState<'all' | 's1' | 's2'>('all');

  // Nouveaux modes
  const [inStoreMode, setInStoreMode] = useState(false);
  const [groupByAisle, setGroupByAisle] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Chargement instantané depuis le cache local
    const loaded = loadLocalData();
    setData(loaded);

    // 2. Détection de connectivité
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      const handleOnline = () => {
        setIsOffline(false);
        flushKitchenOfflineQueue().then(() => {
          loadCloudData().then((fresh) => setData(fresh));
        });
      };
      const handleOffline = () => {
        setIsOffline(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // 3. Synchronisation depuis le cloud Supabase
      loadCloudData().then((cloudData) => {
        setData(cloudData);
      });

      // 4. Écoute temps réel pour les courses (ex: un membre coche un article au supermarché)
      if (isSupabaseConfigured()) {
        const channel = supabase
          .channel('courses_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'family_kitchen' },
            () => {
              loadCloudData().then((fresh) => setData(fresh));
            }
          )
          .subscribe();

        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          supabase.removeChannel(channel);
        };
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Consolidation des ingrédients depuis le planning de la semaine
  const aggregatedItems = useMemo(() => {
    if (!data || !data.weeklyPlan || !data.recipes) return [];

    const checkedItems = data.checkedItems || {};
    const map = new Map<string, { name: string; quantity: number; unit: string; category: string }>();

    Object.entries(data.weeklyPlan).forEach(([slotKey, meal]) => {
      if (!meal || !meal.recipeId) return;

      const isS2 = slotKey.startsWith('s2_') || meal.week === 's2';
      const isS1 = !isS2;

      if (weekFilter === 's1' && !isS1) return;
      if (weekFilter === 's2' && !isS2) return;

      const recipe = data.recipes.find((r) => r.id === meal.recipeId);
      if (!recipe || !Array.isArray(recipe.ingredients)) return;

      const scale =
        meal.servings && recipe.defaultServings
          ? meal.servings / recipe.defaultServings
          : 1;

      recipe.ingredients.forEach((ing) => {
        if (!ing || !ing.name) return;
        const ingName = String(ing.name).trim();
        const ingUnit = String(ing.unit || '').trim();
        const key = `${ingName.toLowerCase()}_${ingUnit.toLowerCase()}`;
        const qty = (typeof ing.quantity === 'number' ? ing.quantity : 1) * scale;

        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.quantity += qty;
        } else {
          map.set(key, {
            name: ingName,
            quantity: qty,
            unit: ingUnit,
            category: ing.category || autoDetectCategory(ingName),
          });
        }
      });
    });

    const list: ShoppingItem[] = [];
    map.forEach((item, key) => {
      // Ingrédient retiré manuellement de la liste par l'utilisateur
      if (checkedItems[`${HIDDEN_PREFIX}agg_${key}`]) return;
      list.push({
        id: `agg_${key}`,
        name: item.name,
        quantity: Math.round(item.quantity * 10) / 10,
        unit: item.unit,
        category: item.category,
        checked: Boolean(checkedItems[`agg_${key}`]),
      });
    });

    return list;
  }, [data, weekFilter]);

  const allItems = useMemo(() => {
    if (!data) return [];
    const customItems = Array.isArray(data.customShoppingItems) ? data.customShoppingItems : [];
    return [...aggregatedItems, ...customItems];
  }, [data, aggregatedItems]);

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => (inStoreMode ? !item.checked : true));
  }, [allItems, inStoreMode]);

  const uncheckedCount = useMemo(() => {
    return allItems.filter((i) => !i.checked).length;
  }, [allItems]);

  const hasPlannedMeals = useMemo(() => {
    return data?.weeklyPlan ? Object.keys(data.weeklyPlan).length > 0 : false;
  }, [data]);

  const hiddenCount = useMemo(() => {
    if (!data?.checkedItems) return 0;
    return Object.entries(data.checkedItems).filter(
      ([k, v]) => k.startsWith(HIDDEN_PREFIX) && v
    ).length;
  }, [data]);

  // Regroupement par rayons
  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    visibleItems.forEach((it) => {
      const cat = it.category && CATEGORY_METADATA[it.category] ? it.category : 'autres';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    });
    return groups;
  }, [visibleItems]);

  const sortedCategories = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      const orderA = CATEGORY_METADATA[a]?.order || 99;
      const orderB = CATEGORY_METADATA[b]?.order || 99;
      return orderA - orderB;
    });
  }, [groupedItems]);

  function persist(updated: AppData) {
    setData(updated);
    syncKitchenCloud(updated.weeklyPlan, updated.customShoppingItems, updated.checkedItems);
  }

  function toggleItem(id: string, isCustom?: boolean) {
    if (!data) return;
    const customList = Array.isArray(data.customShoppingItems) ? data.customShoppingItems : [];
    const checkedMap = data.checkedItems || {};

    if (isCustom) {
      const updatedCustom = customList.map((it) =>
        it.id === id ? { ...it, checked: !it.checked } : it
      );
      persist({ ...data, customShoppingItems: updatedCustom });
    } else {
      const isChecked = Boolean(checkedMap[id]);
      const updatedChecked = { ...checkedMap, [id]: !isChecked };
      persist({ ...data, checkedItems: updatedChecked });
    }
  }

  function handleAddCustomItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemText.trim() || !data) return;

    const detectedCat =
      selectedCategory === 'auto' ? autoDetectCategory(newItemText) : selectedCategory;

    const newItem: ShoppingItem = {
      id: `custom_${Date.now()}`,
      name: newItemText.trim(),
      category: detectedCat,
      checked: false,
      isCustom: true,
    };

    const currentCustom = Array.isArray(data.customShoppingItems) ? data.customShoppingItems : [];
    const updated: AppData = {
      ...data,
      customShoppingItems: [newItem, ...currentCustom],
    };

    persist(updated);
    setNewItemText('');
    setSelectedCategory('auto');
  }

  function handleDeleteItem(item: ShoppingItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!data) return;
    const currentCustom = Array.isArray(data.customShoppingItems) ? data.customShoppingItems : [];
    const currentChecked = data.checkedItems || {};

    if (item.isCustom) {
      persist({
        ...data,
        customShoppingItems: currentCustom.filter((i) => i.id !== item.id),
      });
    } else {
      const updatedChecked = { ...currentChecked, [`${HIDDEN_PREFIX}${item.id}`]: true };
      delete updatedChecked[item.id];
      persist({ ...data, checkedItems: updatedChecked });
    }
  }

  function handleClearChecked() {
    if (!data) return;
    const currentCustom = Array.isArray(data.customShoppingItems) ? data.customShoppingItems : [];
    const updatedCustom = currentCustom.filter((i) => !i.checked);

    const updatedChecked: Record<string, boolean> = { ...(data.checkedItems || {}) };
    aggregatedItems.forEach((i) => {
      if (!i.checked) return;
      delete updatedChecked[i.id];
      updatedChecked[`${HIDDEN_PREFIX}${i.id}`] = true;
    });
    persist({ ...data, customShoppingItems: updatedCustom, checkedItems: updatedChecked });
  }

  function handleRestoreHidden() {
    if (!data) return;
    const updatedChecked: Record<string, boolean> = {};
    Object.entries(data.checkedItems || {}).forEach(([k, v]) => {
      if (!k.startsWith(HIDDEN_PREFIX)) updatedChecked[k] = v;
    });
    persist({ ...data, checkedItems: updatedChecked });
  }

  // Génération du texte de partage
  function generateShareText() {
    const activeItems = allItems.filter((i) => !i.checked);
    if (activeItems.length === 0) return '🛒 Ma liste de courses Keo Family est vide !';

    const grouped: Record<string, ShoppingItem[]> = {};
    activeItems.forEach((it) => {
      const cat = it.category && CATEGORY_METADATA[it.category] ? it.category : 'autres';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(it);
    });

    let text = '🛒 *Liste de courses Keo Family :*\n\n';
    Object.keys(CATEGORY_METADATA)
      .sort((a, b) => CATEGORY_METADATA[a].order - CATEGORY_METADATA[b].order)
      .forEach((catKey) => {
        const itemsInCat = grouped[catKey];
        if (itemsInCat && itemsInCat.length > 0) {
          const meta = CATEGORY_METADATA[catKey];
          text += `${meta.icon} *${meta.label}*\n`;
          itemsInCat.forEach((it) => {
            const qty = it.quantity ? ` (${it.quantity} ${it.unit || ''})` : '';
            text += `▫️ ${it.name}${qty}\n`;
          });
          text += '\n';
        }
      });

    return text.trim();
  }

  async function handleCopyList() {
    try {
      const text = generateShareText();
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.warn('Impossible de copier:', err);
    }
  }

  function handleShareWhatsApp() {
    const text = generateShareText();
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  // Si les données sont en cours de chargement depuis localStorage
  if (!data) {
    return (
      <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
        <Header title="Liste de Courses" />
        <CuisineTabs />
        <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-xs">
          Chargement de la liste de courses...
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <Header title="Liste de Courses" onRefresh={() => loadCloudData().then(setData)} />
      <CuisineTabs />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* BANNIÈRE HORS-LIGNE / EN MAGASIN */}
        {isOffline && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <WifiOff className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <span className="font-bold">Mode magasin / Hors-ligne actif :</span> Vos courses sont affichées depuis la mémoire de votre appareil. Cochez vos articles sans crainte, tout sera synchronisé dès le retour du réseau.
            </div>
          </div>
        )}

        {/* Sélecteur de période pour les courses (2 semaines) */}
        <div className="grid grid-cols-3 p-1 bg-gray-200/70 dark:bg-slate-800 rounded-2xl text-[11px] font-bold shadow-xs">
          <button
            type="button"
            onClick={() => setWeekFilter('all')}
            className={`py-2 rounded-xl transition ${
              weekFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Les 2 semaines
          </button>
          <button
            type="button"
            onClick={() => setWeekFilter('s1')}
            className={`py-2 rounded-xl transition ${
              weekFilter === 's1'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setWeekFilter('s2')}
            className={`py-2 rounded-xl transition ${
              weekFilter === 's2'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Semaine pro.
          </button>
        </div>

        {/* Résumé & Boutons d'action */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Articles à acheter</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {uncheckedCount} restant(s) sur {allItems.length}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 text-primary-600 dark:text-primary-400 bg-orange-50 dark:bg-primary-950/60 hover:bg-orange-100 dark:hover:bg-primary-900 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
                title="Partager la liste"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Partager</span>
              </button>

              {hiddenCount > 0 && (
                <button
                  onClick={handleRestoreHidden}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold px-2 py-1.5 rounded-lg transition"
                  title="Remettre dans la liste les ingrédients du planning supprimés"
                >
                  Restaurer ({hiddenCount})
                </button>
              )}
              {allItems.some((i) => i.checked) && (
                <button
                  onClick={handleClearChecked}
                  className="text-xs text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1.5 rounded-lg transition"
                >
                  Vider cochés
                </button>
              )}
            </div>
          </div>

          {/* Barres d'options : Mode magasin & Vue par rayons */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
            <button
              onClick={() => setInStoreMode(!inStoreMode)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                inStoreMode
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-650'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Mode Magasin</span>
              {inStoreMode && <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded-full">Actif</span>}
            </button>

            <button
              onClick={() => setGroupByAisle(!groupByAisle)}
              className="px-3 py-1.5 rounded-xl font-semibold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-650 transition flex items-center gap-1.5"
            >
              {groupByAisle ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              <span>{groupByAisle ? 'Par rayons' : 'Vue liste'}</span>
            </button>
          </div>
        </div>

        {/* Message d'explication si planning vide */}
        {!hasPlannedMeals && (
          <div className="p-3.5 bg-orange-50/70 dark:bg-primary-950/30 border border-orange-100 dark:border-primary-800 rounded-2xl flex items-start gap-2.5 text-xs text-orange-950 dark:text-orange-200">
            <Info className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-950 dark:text-primary-200">Votre planning est vide</p>
              <p className="text-orange-900/80 dark:text-slate-300 mt-0.5 leading-relaxed">
                Les ingrédients s’ajoutent ici automatiquement quand vous programmez des recettes dans le{' '}
                <Link href="/planning" className="font-bold text-primary-700 dark:text-primary-400 underline">
                  Planning
                </Link>
                . Vous pouvez aussi ajouter des articles libres ci-dessous.
              </p>
            </div>
          </div>
        )}

        {/* Formulaire d'ajout rapide avec auto-catégorisation */}
        <form onSubmit={handleAddCustomItem} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ajouter un article (ex: Bananes, Café, Savon...)"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs dark:text-white"
            />
            <button
              type="submit"
              className="p-2.5 bg-primary-600 text-white rounded-xl shadow-xs hover:bg-primary-700 transition flex-shrink-0"
              title="Ajouter à la liste"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Rayon suggéré / modifiable */}
          {newItemText.trim() && (
            <div className="flex items-center gap-2 text-xs bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              <span className="text-gray-500 dark:text-gray-400">Rayon :</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs text-gray-800 dark:text-white font-medium focus:outline-none"
              >
                <option value="auto">
                  Automatique ({CATEGORY_METADATA[autoDetectCategory(newItemText)]?.label || 'Épicerie'})
                </option>
                {Object.entries(CATEGORY_METADATA).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.icon} {meta.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        {/* LISTE DES ARTICLES */}
        {allItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto stroke-1 mb-2 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Votre liste de courses est vide !</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              Ajoutez un repas dans votre planning ou ajoutez un article manuel avec le formulaire ci-dessus.
            </p>
          </div>
        ) : groupByAisle ? (
          /* VUE REGROUPÉE PAR RAYONS */
          <div className="space-y-4">
            {sortedCategories.map((catKey) => {
              const items = groupedItems[catKey];
              if (!items || items.length === 0) return null;
              const meta = CATEGORY_METADATA[catKey] || CATEGORY_METADATA.autres;
              const remainingInCat = items.filter((i) => !i.checked).length;

              return (
                <div key={catKey} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </h3>
                    <span className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">
                      {remainingInCat} restant(s)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <ShoppingItemCard
                        key={item.id}
                        item={item}
                        onToggle={() => toggleItem(item.id, item.isCustom)}
                        onDelete={(e) => handleDeleteItem(item, e)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VUE LISTE PLATE */
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                onToggle={() => toggleItem(item.id, item.isCustom)}
                onDelete={(e) => handleDeleteItem(item, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE PARTAGE DE LA LISTE */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Partager la liste de courses</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Partagez la liste avec le reste de la famille pour qu'ils sachent quoi acheter :
            </p>

            <div className="space-y-2">
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Envoyer sur WhatsApp</span>
              </button>

              <button
                onClick={handleCopyList}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2"
              >
                {copiedText ? (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">Liste copiée dans le presse-papier !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span>Copier le texte de la liste</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingItemCard({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
        item.checked
          ? 'bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 opacity-60'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-xs hover:border-primary-300 dark:hover:border-primary-600'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition flex-shrink-0 ${
          item.checked
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700'
        }`}
      >
        {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            item.checked ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white'
          }`}
        >
          {item.name}
        </p>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">
          {item.isCustom ? 'Ajout manuel' : 'Ingrédient du planning'}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {item.quantity ? (
          <span
            className={`text-xs font-bold px-2 py-1 rounded-md ${
              item.checked
                ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                : 'bg-orange-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300'
            }`}
          >
            {item.quantity} {item.unit}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="p-2 -mr-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition rounded-lg"
          title="Supprimer cet article"
          aria-label={`Supprimer ${item.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
