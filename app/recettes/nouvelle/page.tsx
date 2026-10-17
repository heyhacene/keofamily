'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Recipe, Ingredient } from '@/types';
import { saveCloudRecipe } from '@/lib/storage';
import { useAuth } from '@/lib/authContext';
import { Plus, Trash2, ArrowLeft, Wand2, Link2, FileText, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NouvelleRecettePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'plat' | 'entree' | 'dessert' | 'rapide'>('plat');
  const [servings, setServings] = useState(4);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(20);
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: 'ing_1', name: '', quantity: 100, unit: 'g', category: 'epicerie' },
  ]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');

  // États pour la modale d'importation Cookidoo / Web
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'url'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleAddIngredient() {
    setIngredients([
      ...ingredients,
      { id: `ing_${Date.now()}`, name: '', quantity: 1, unit: 'pièce(s)', category: 'epicerie' },
    ]);
  }

  function handleRemoveIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function handleAddStep() {
    setSteps([...steps, '']);
  }

  function handleRemoveStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    setImportError(null);
    setImportLoading(true);

    try {
      const payload = importTab === 'paste' ? { rawText: pasteText } : { url: urlInput };
      const res = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.recipe) {
        throw new Error(data.error || 'Erreur lors de l’analyse de la recette.');
      }

      const r = data.recipe;
      if (r.title) setTitle(r.title);
      if (r.category) setCategory(r.category);
      if (r.defaultServings) setServings(r.defaultServings);
      if (r.prepTimeMinutes) setPrepTime(r.prepTimeMinutes);
      if (r.cookTimeMinutes) setCookTime(r.cookTimeMinutes);
      if (r.imageUrl) setImageUrl(r.imageUrl);
      if (r.ingredients && r.ingredients.length > 0) setIngredients(r.ingredients);
      if (r.steps && r.steps.length > 0) setSteps(r.steps);
      if (r.notes) setNotes(r.notes);

      setShowImportModal(false);
      setPasteText('');
      setUrlInput('');
    } catch (err: any) {
      setImportError(err.message || 'Impossible d’importer la recette.');
    } finally {
      setImportLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const validIngredients = ingredients.filter((i) => i.name.trim() !== '');
    const validSteps = steps.filter((s) => s.trim() !== '');

    const newRecipe: Recipe = {
      id: `rec_${Date.now()}`,
      title: title.trim(),
      category,
      defaultServings: servings,
      prepTimeMinutes: prepTime,
      cookTimeMinutes: cookTime,
      imageUrl: imageUrl.trim() || undefined,
      ingredients: validIngredients,
      steps: validSteps,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveCloudRecipe(newRecipe, user?.id);
    router.push('/recettes');
  }

  return (
    <div className="pb-10">
      <Header title="Nouvelle Recette" />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/recettes" className="text-xs text-primary-600 font-semibold flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour aux recettes
          </Link>

          {/* Bouton Magique pour Cookidoo & Web */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Importer Cookidoo / Web</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Titre de la recette</label>
            <input
              type="text"
              required
              placeholder="Ex: Velouté de potimarron Thermomix"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 bg-white"
              >
                <option value="plat">Plat</option>
                <option value="rapide">Rapide</option>
                <option value="entree">Entrée</option>
                <option value="dessert">Dessert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Portions de base</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Préparation (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cuisson (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Lien photo (optionnel)</label>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>
        </div>

        {/* Ingrédients */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">Ingrédients</h3>
            <button
              type="button"
              onClick={handleAddIngredient}
              className="text-xs text-primary-600 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>

          {ingredients.map((ing, i) => (
            <div key={ing.id} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Nom (ex: Farine)"
                value={ing.name}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].name = e.target.value;
                  setIngredients(copy);
                }}
                className="flex-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <input
                type="number"
                placeholder="Qté"
                value={ing.quantity}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].quantity = Number(e.target.value);
                  setIngredients(copy);
                }}
                className="w-16 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-center"
              />
              <input
                type="text"
                placeholder="Unité"
                value={ing.unit}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].unit = e.target.value;
                  setIngredients(copy);
                }}
                className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveIngredient(i)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Étapes */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">Étapes de préparation</h3>
            <button
              type="button"
              onClick={handleAddStep}
              className="text-xs text-primary-600 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-4 h-4" /> Ajouter étape
            </button>
          </div>

          {steps.map((st, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-1.5">
                {i + 1}
              </span>
              <textarea
                rows={2}
                placeholder={`Étape ${i + 1}...`}
                value={st}
                onChange={(e) => {
                  const copy = [...steps];
                  copy[i] = e.target.value;
                  setSteps(copy);
                }}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveStep(i)}
                className="text-gray-400 hover:text-red-500 p-1 mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Astuces Thermomix</label>
          <textarea
            rows={2}
            placeholder="Ex: Vitesse 5, température Varoma..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 transition text-sm"
        >
          Enregistrer la recette
        </button>
      </form>

      {/* MODALE D'IMPORTATION COOKIDOO & WEB */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-gray-900 text-base">Assistant d'Import Rapide</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Choix du mode d'import */}
              <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setImportTab('paste')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                    importTab === 'paste' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Copier-Coller Cookidoo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportTab('url')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                    importTab === 'url' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Par lien Web (URL)</span>
                </button>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importTab === 'paste' ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Sur <strong>Cookidoo</strong> ou votre site : sélectionnez tout le texte de la recette (titre, ingrédients, étapes), copiez et collez-le ici :
                  </p>
                  <textarea
                    rows={8}
                    required
                    placeholder={`Exemple :\nRisotto aux champignons Thermomix\n4 personnes\n\nIngrédients :\n300 g de riz arborio\n200 g de champignons\n1 échalote\n50 g de parmesan\n\nPréparation :\n1. Mettre l'échalote dans le bol, hacher 5 sec / vitesse 5.\n2. Ajouter un filet d'huile, rissoler 3 min.`}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-primary-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Collez l'adresse web de la recette (Marmiton, 750g, blogs culinaires...) :
                  </p>
                  <input
                    type="url"
                    required
                    placeholder="https://www.marmiton.org/recettes/..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={importLoading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importLoading ? 'Analyse en cours...' : '🪄 Extraire et remplir le formulaire'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
