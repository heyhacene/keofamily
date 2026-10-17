'use client';

export type DocumentCategory =
  | 'identite'
  | 'medical'
  | 'scolaire'
  | 'logement'
  | 'vehicules'
  | 'assurance'
  | 'autre';

export interface FamilyDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  member_name: string;
  document_number?: string;
  expiry_date?: string; // YYYY-MM-DD
  file_name: string;
  file_type: string;
  file_data: string; // base64 data URL ou URL publique
  file_size?: number; // en octets
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_CATEGORIES: {
  id: DocumentCategory;
  label: string;
  icon: string;
  color: string;
  bgLight: string;
  description: string;
}[] = [
  {
    id: 'identite',
    label: 'Identité & Famille',
    icon: '🪪',
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
    description: 'Passeports, Cartes d’identité, Livret de famille, Actes d’état civil',
  },
  {
    id: 'medical',
    label: 'Santé & Médical',
    icon: '🏥',
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
    description: 'Cartes Vitales, Ordonnances, Vaccins, Attestations mutuelle',
  },
  {
    id: 'scolaire',
    label: 'Scolarité & Enfants',
    icon: '🏫',
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
    description: 'Attestations scolaires, Certificats, Inscriptions, Cantine',
  },
  {
    id: 'logement',
    label: 'Logement & Factures',
    icon: '🏠',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
    description: 'Baux, Factures EDF/Gaz/Eau, Quittances de loyer, Taxes',
  },
  {
    id: 'vehicules',
    label: 'Véhicules & Auto',
    icon: '🚗',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
    description: 'Cartes grises, Permis de conduire, Contrôles techniques, Assurances auto',
  },
  {
    id: 'assurance',
    label: 'Assurances & Banques',
    icon: '🛡️',
    color: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900',
    description: 'Responsabilité civile, Habitation, Prévoyance, RIB',
  },
  {
    id: 'autre',
    label: 'Autres documents',
    icon: '📁',
    color: 'text-gray-600 dark:text-gray-400',
    bgLight: 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700',
    description: 'Garanties, Notices, Factures diverses',
  },
];

const STORAGE_KEY = 'dar_family_documents_v1';

export function getLocalDocuments(): FamilyDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erreur lecture documents locaux:', err);
    return [];
  }
}

export function saveLocalDocuments(docs: FamilyDocument[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    window.dispatchEvent(new CustomEvent('dar:documents-updated'));
  } catch (err) {
    console.error('Erreur sauvegarde documents locaux:', err);
  }
}

export function addDocument(doc: Omit<FamilyDocument, 'id' | 'created_at' | 'updated_at'>): FamilyDocument {
  const docs = getLocalDocuments();
  const newDoc: FamilyDocument = {
    ...doc,
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  docs.unshift(newDoc);
  saveLocalDocuments(docs);
  return newDoc;
}

export function updateDocument(id: string, updates: Partial<FamilyDocument>): FamilyDocument | null {
  const docs = getLocalDocuments();
  const index = docs.findIndex((d) => d.id === id);
  if (index === -1) return null;
  docs[index] = {
    ...docs[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveLocalDocuments(docs);
  return docs[index];
}

export function deleteDocument(id: string): boolean {
  const docs = getLocalDocuments();
  const filtered = docs.filter((d) => d.id !== id);
  if (filtered.length === docs.length) return false;
  saveLocalDocuments(filtered);
  return true;
}

/**
 * Calcule si le document expire bientôt (< 90 jours) ou est déjà expiré
 */
export function getExpiryStatus(expiryDateStr?: string): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  formatted: string | null;
} {
  if (!expiryDateStr) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, formatted: null };
  }

  const exp = new Date(expiryDateStr);
  if (isNaN(exp.getTime())) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, formatted: null };
  }

  const now = new Date();
  // Ne comparer que les jours
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isExpired = daysRemaining < 0;
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 90;

  const formatted = exp.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return { isExpired, isExpiringSoon, daysRemaining, formatted };
}
