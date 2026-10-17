import { Ingredient } from '@/types';

// Détecteur de catégorie d'ingrédient
export function detectCategory(name: string): Ingredient['category'] {
  const lower = name.toLowerCase();
  if (/poulet|boeuf|porc|veau|viande|lardon|jambon|poisson|saumon|cabillaud|crevette|thon/.test(lower)) {
    return 'viandes_poissons';
  }
  if (/pomme|carotte|tomate|courgette|oignon|ail|salade|poireau|poivron|champignon|pomme de terre|citron|banane/.test(lower)) {
    return 'fruits_legumes';
  }
  if (/lait|beurre|creme|crème|parmesan|gruyere|gruyère|fromage|mozzarella|yaourt|oeuf|œuf/.test(lower)) {
    return 'frais_cremerie';
  }
  if (/pain|baguette|brioche|farine/.test(lower)) {
    return 'boulangerie';
  }
  if (/eau|jus|vin|biere|café|the|thé/.test(lower)) {
    return 'boissons';
  }
  return 'epicerie';
}

// Analyseur de ligne d'ingrédient (ex: "200 g de farine", "3 carottes", "1 c. à soupe d'huile")
export function parseIngredientLine(line: string): Ingredient {
  const cleaned = line.trim().replace(/^[-•*]\s*/, '');
  
  // Regex pour attraper quantité, unité et nom
  const regex = /^([\d½¼¾.,\s/]+)?\s*(g|kg|ml|cl|l|litre|litres|c\.\s*à\s*soupe|c\.\s*à\s*café|cas|cac|càs|càc|pincée|pincées|sachet|sachets|gousse|gousses|tranche|tranches|boîte|boîtes)?\s*(?:de|d'|d’)?\s*(.+)$/i;
  
  const match = cleaned.match(regex);
  if (match) {
    let qtyStr = match[1]?.trim().replace(',', '.') || '1';
    let qty = parseFloat(qtyStr);
    if (isNaN(qty)) qty = 1;

    let unit = match[2]?.trim() || 'pièce(s)';
    let name = match[3]?.trim() || cleaned;

    return {
      id: `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: qty,
      unit: unit,
      category: detectCategory(name),
    };
  }

  return {
    id: `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleaned,
    quantity: 1,
    unit: 'pièce(s)',
    category: detectCategory(cleaned),
  };
}

// Convertisseur de durée ISO 8601 (PT20M -> 20 min)
export function parseIsoDuration(durationStr: string): number {
  if (!durationStr) return 15;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return parseInt(durationStr, 10) || 15;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
}
