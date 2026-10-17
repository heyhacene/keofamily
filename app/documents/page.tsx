'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import DocumentModal from '@/components/DocumentModal';
import {
  FamilyDocument,
  DocumentCategory,
  DOCUMENT_CATEGORIES,
  getLocalDocuments,
  deleteDocument,
  getExpiryStatus,
} from '@/lib/documentVault';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  FileText,
  Search,
  Plus,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Download,
  Eye,
  Trash2,
  Edit2,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  User,
  Filter,
  X,
  ExternalLink,
} from 'lucide-react';

export default function DocumentVaultPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<FamilyDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<FamilyDocument | null>(null);

  // Aperçu du document
  const [previewDoc, setPreviewDoc] = useState<FamilyDocument | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Liste des membres de la famille
  const [familyMembers, setFamilyMembers] = useState<string[]>([
    'Toute la famille',
    'Sarah',
    'Hacène',
    'Enfants',
  ]);

  const loadDocs = () => {
    const docs = getLocalDocuments();
    setDocuments(docs);
  };

  useEffect(() => {
    loadDocs();

    // Écouter les mises à jour
    const handleUpdate = () => loadDocs();
    window.addEventListener('dar:documents-updated', handleUpdate);

    // Charger les profils de la famille si connecté à Supabase
    if (isSupabaseConfigured()) {
      supabase
        .from('profiles')
        .select('full_name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            const names = Array.from(
              new Set([
                'Toute la famille',
                ...data.map((p) => p.full_name).filter(Boolean) as string[],
              ])
            );
            setFamilyMembers(names);
          }
        });
    }

    return () => {
      window.removeEventListener('dar:documents-updated', handleUpdate);
    };
  }, []);

  const handleDelete = (doc: FamilyDocument) => {
    if (confirm(`Voulez-vous vraiment supprimer « ${doc.title} » du coffre ?`)) {
      deleteDocument(doc.id);
      loadDocs();
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
      }
    }
  };

  const handleCopyNumber = (num: string, id: string) => {
    try {
      navigator.clipboard.writeText(num);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  // Filtrage et recherche
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Filtre catégorie
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false;
      }
      // Filtre membre
      if (selectedMember !== 'all' && doc.member_name !== selectedMember) {
        return false;
      }
      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchNumber = doc.document_number?.toLowerCase().includes(q);
        const matchMember = doc.member_name.toLowerCase().includes(q);
        const matchNotes = doc.notes?.toLowerCase().includes(q);
        return matchTitle || matchNumber || matchMember || matchNotes;
      }
      return true;
    });
  }, [documents, selectedCategory, selectedMember, searchQuery]);

  // Documents qui expirent bientôt
  const expiringDocs = useMemo(() => {
    return documents
      .map((doc) => ({ doc, status: getExpiryStatus(doc.expiry_date) }))
      .filter(({ status }) => status.isExpired || status.isExpiringSoon);
  }, [documents]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 text-gray-900 dark:text-gray-100 transition-colors">
      <Header title="Coffre de Documents" onRefresh={loadDocs} />

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* EN-TÊTE AVEC BOUTON RETOUR & AJOUTER */}
        <div className="flex items-center justify-between">
          <Link
            href="/famille"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour Espace Famille</span>
          </Link>

          <button
            onClick={() => {
              setEditingDoc(null);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-primary-600 to-amber-600 hover:from-primary-700 hover:to-amber-700 text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Document</span>
          </button>
        </div>

        {/* BANNIÈRE D'ALERTE EXPIRATION SI NÉCESSAIRE */}
        {expiringDocs.length > 0 && (
          <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 shadow-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                {expiringDocs.length} document(s) à renouveler ou expirés
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {expiringDocs.map(({ doc, status }) => (
                  <span
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-300 cursor-pointer hover:bg-amber-100"
                  >
                    <span>{doc.title}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      ({status.isExpired ? 'Expiré' : `${status.daysRemaining} j`})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BARRE DE RECHERCHE */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un passeport, carte vitale, assurance, contrat..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 outline-none shadow-xs"
          />
        </div>

        {/* FILTRES CATÉGORIES (HORIZONTAL SCROLL) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <span>📁 Tous ({documents.length})</span>
          </button>

          {DOCUMENT_CATEGORIES.map((cat) => {
            const count = documents.filter((d) => d.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label.split(' ')[0]}</span>
                {count > 0 && <span className="opacity-80 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* LISTE DES DOCUMENTS */}
        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/60 rounded-3xl border border-gray-200 dark:border-slate-700/80 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-slate-700 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Aucun document trouvé
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Essayez de modifier votre recherche ou vos filtres.'
                  : 'Ajoutez votre premier document (passeport, carte vitale, bail, assurance...).'}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDoc(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl text-xs transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredDocs.map((doc) => {
              const catInfo = DOCUMENT_CATEGORIES.find((c) => c.id === doc.category) || DOCUMENT_CATEGORIES[6];
              const expStatus = getExpiryStatus(doc.expiry_date);

              return (
                <div
                  key={doc.id}
                  className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-gray-150 dark:border-slate-700/80 hover:border-primary-300 dark:hover:border-primary-700 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    {/* EN-TÊTE CARTE */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0 p-1.5 rounded-xl bg-gray-50 dark:bg-slate-700">
                          {catInfo.icon}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {doc.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1">
                            <User className="w-3 h-3 text-primary-500" />
                            <span>{doc.member_name}</span>
                          </span>
                        </div>
                      </div>

                      {/* BADGE EXPIRATION */}
                      {expStatus.formatted && (
                        <div className="shrink-0 text-right">
                          {expStatus.isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              Expiré ({expStatus.formatted})
                            </span>
                          ) : expStatus.isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Dans {expStatus.daysRemaining} j
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-mono">
                              Exp: {expStatus.formatted}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* NUMÉRO DE DOCUMENT SI DISPONIBLE */}
                    {doc.document_number && (
                      <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate">
                          {doc.document_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(doc.document_number!, doc.id)}
                          className="p-1 text-gray-400 hover:text-primary-600 rounded-lg"
                          title="Copier le numéro"
                        >
                          {copiedId === doc.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* NOTES */}
                    {doc.notes && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  {/* ACTIONS INFÉRIEURES */}
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-750 flex items-center justify-between">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="px-3 py-1.5 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <a
                        href={doc.file_data}
                        download={doc.file_name || doc.title}
                        className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => {
                          setEditingDoc(doc);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODALE D'AJOUT / ÉDITION */}
      <DocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentToEdit={editingDoc}
        familyMembers={familyMembers}
        onSaved={() => loadDocs()}
      />

      {/* MODALE D'APERÇU DU DOCUMENT */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* HEADER APERÇU */}
            <div className="px-5 py-4 border-b border-gray-150 dark:border-slate-800 flex items-center justify-between bg-gray-50/80 dark:bg-slate-850">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {previewDoc.member_name} • {previewDoc.file_name}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={previewDoc.file_data}
                  download={previewDoc.file_name || previewDoc.title}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </a>

                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CONTENU APERÇU (IMAGE OU IFRAME PDF) */}
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-gray-100 dark:bg-slate-950">
              {previewDoc.file_data.startsWith('data:image') || previewDoc.file_type.includes('image') ? (
                <img
                  src={previewDoc.file_data}
                  alt={previewDoc.title}
                  className="max-h-[65vh] w-auto rounded-2xl shadow-md object-contain border border-gray-200 dark:border-slate-800"
                />
              ) : previewDoc.file_data.startsWith('data:application/pdf') || previewDoc.file_type.includes('pdf') ? (
                <iframe
                  src={previewDoc.file_data}
                  title={previewDoc.title}
                  className="w-full h-[65vh] rounded-2xl border border-gray-200 dark:border-slate-800 shadow-md bg-white"
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText className="w-12 h-12 text-primary-500 mx-auto" />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Aperçu direct non disponible pour ce format ({previewDoc.file_type}).
                  </p>
                  <a
                    href={previewDoc.file_data}
                    download={previewDoc.file_name}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le fichier</span>
                  </a>
                </div>
              )}
            </div>

            {/* FOOTER AVEC DÉTAILS */}
            {previewDoc.document_number && (
              <div className="px-5 py-3 border-t border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Numéro de document :</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white select-all">
                  {previewDoc.document_number}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
