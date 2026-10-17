export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: 'fruits_legumes' | 'viandes_poissons' | 'epicerie' | 'frais_cremerie' | 'boulangerie' | 'boissons' | 'hygiene' | 'autres';
}

export interface Recipe {
  id: string;
  title: string;
  category: 'plat' | 'entree' | 'dessert' | 'rapide';
  defaultServings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  imageUrl?: string;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  updatedAt: string;
}

export type DayOfWeek = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
export type MealType = 'midi' | 'soir';
export type WeekSelection = 's1' | 's2';

export interface PlannedMeal {
  id: string;
  week?: WeekSelection;
  day: DayOfWeek;
  type: MealType;
  recipeId?: string;
  customTitle?: string;
  servings: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  checked: boolean;
  isCustom?: boolean;
}

export interface AppData {
  recipes: Recipe[];
  weeklyPlan: Record<string, PlannedMeal>; // clé: `${week}_${day}_${type}` ou `${day}_${type}`
  customShoppingItems: ShoppingItem[];
  checkedItems: Record<string, boolean>;
  lastSync?: string;
}
