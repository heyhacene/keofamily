'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Calendar,
  FileText,
  User,
  ShieldAlert,
  Hash,
  AlertCircle,
  FileCheck,
  Check,
  Camera,
} from 'lucide-react';
import {
  FamilyDocument,
  DocumentCategory,
  DOCUMENT_CATEGORIES,
  addDocument,
  updateDocument,
} from '@/lib/documentVault';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentToEdit?: FamilyDocument | null;
  familyMembers?: string[];
  onSaved?: (doc: FamilyDocument) => void;
}

export default function DocumentModal({
  isOpen,
  onClose,
  documentToEdit,
  familyMembers = ['Toute la famille', 'Sarah', 'Hacène', 'Enfants'],
  onSaved,
}: DocumentModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('identite');
  const [memberName, setMemberName] = useState(familyMembers[0] || 'Toute la famille');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileData, setFileData] = useState('');
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (documentToEdit) {
      setTitle(documentToEdit.title);
      setCategory(documentToEdit.category);
      setMemberName(documentToEdit.member_name || familyMembers[0] || 'Toute la famille');
      setDocumentNumber(documentToEdit.document_number || '');
      setExpiryDate(documentToEdit.expiry_date || '');
      setNotes(documentToEdit.notes || '');
      setFileName(documentToEdit.file_name || '');
      setFileType(documentToEdit.file_type || '');
      setFileData(documentToEdit.file_data || '');
      setFileSize(documentToEdit.file_size);
    } else {
      setTitle('');
      setCategory('identite');
      setMemberName(familyMembers[0] || 'Toute la famille');
      setDocumentNumber('');
      setExpiryDate('');
      setNotes('');
      setFileName('');
      setFileType('');
      setFileData('');
      setFileSize(undefined);
    }
    setFileError(null);
  }, [documentToEdit, isOpen, familyMembers]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de taille : 8 Mo
    if (file.size > 8 * 1024 * 1024) {
      setFileError('Le fichier dépasse la taille maximale autorisée (8 Mo).');
      return;
    }

    setFileError(null);
    setFileName(file.name);
    setFileType(file.type || 'application/octet-stream');
    setFileSize(file.size);

    if (!title) {
      // Préremplir le titre avec le nom du fichier sans extension
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!fileData && !documentToEdit) {
      setFileError('Veuillez joindre un document ou une photo.');
      return;
    }

    let savedDoc: FamilyDocument;
    if (documentToEdit) {
      savedDoc = updateDocument(documentToEdit.id, {
        title: title.trim(),
        category,
        member_name: memberName,
        document_number: documentNumber.trim() || undefined,
        expiry_date: expiryDate || undefined,
        notes: notes.trim() || undefined,
        fileName: fileName || documentToEdit.file_name,
        fileType: fileType || documentToEdit.file_type,
        fileData: fileData || documentToEdit.file_data,
        fileSize: fileSize !== undefined ? fileSize : documentToEdit.file_size,
      })!;
    } else {
      savedDoc = addDocument({
        title: title.trim(),
        category,
        member_name: memberName,
        document_number: documentNumber.trim() || undefined,
        expiry_date: expiryDate || undefined,
        file_name: fileName || 'document',
        file_type: fileType || 'application/pdf',
        file_data: fileData,
        file_size: fileSize,
        notes: notes.trim() || undefined,
      });
    }

    if (onSaved) onSaved(savedDoc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-slate-850 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                {documentToEdit ? 'Modifier le document' : 'Ajouter un document familial'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Coffre sécurisé chiffré pour la famille
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU DU FORMULAIRE */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* UPLOAD FICHIER / PHOTO */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Fichier ou Photo du document *
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            {fileData || fileName ? (
              <div className="p-3 bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-900 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-primary-600 text-white shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {fileName || 'Document joint'}
                    </p>
                    {fileSize && (
                      <p className="text-[10px] text-gray-400">
                        {(fileSize / 1024).toFixed(0)} Ko • {fileType.split('/')[1]?.toUpperCase() || 'DOC'}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 text-primary-600 dark:text-primary-400 font-bold text-xs rounded-xl border border-primary-200 dark:border-primary-800 transition"
                >
                  Remplacer
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-primary-500 rounded-2xl p-6 text-center cursor-pointer transition bg-gray-50/50 dark:bg-slate-800/40 hover:bg-primary-50/30"
              >
                <div className="mx-auto w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Cliquez pour importer un PDF ou prendre une Photo
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Cartes, passeports, attestations, ordonnances (max 8 Mo)
                </p>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fileError}</span>
              </p>
            )}
          </div>

          {/* TITRE DU DOCUMENT */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Nom du document *
            </label>
            <input
              type="text"
              required
              placeholder="ex: Passeport Sarah, Carte Vitale 2026, Assurance Habitation..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* CATÉGORIE DU DOCUMENT */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              Catégorie
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-2xl border text-left transition flex items-center gap-2 ${
                    category === cat.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-white font-bold ring-1 ring-primary-500'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-xs truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MEMBRE CONCERNÉ */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Membre de la famille
            </label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <select
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {familyMembers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NUMÉRO DE DOCUMENT & DATE D'EXPIRATION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Numéro / Identifiant (optionnel)
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ex: 18AA12345, n° contrat"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Date d'expiration (optionnel)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* NOTES COMPLÉMENTAIRES */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Remarques ou instructions confidentielles
            </label>
            <textarea
              rows={2}
              placeholder="ex: Renouvellement à faire en mairie, code d'accès, contact assureur..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* BOUTON D'ENREGISTREMENT */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-amber-600 hover:from-primary-700 hover:to-amber-700 text-white font-bold rounded-2xl text-xs transition shadow-md shadow-primary-600/20 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{documentToEdit ? 'Enregistrer les modifications' : 'Ajouter au Coffre Familial'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
