'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  X,
  Send,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Calendar,
  Utensils,
  BookOpen,
  ShoppingCart,
  CheckSquare,
  Settings,
  Download,
  Shield,
  HelpCircle,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import {
  SUPPORT_FAQS,
  findBestAnswer,
  askGeminiAssistant,
  SupportAction,
} from '@/lib/supportKnowledge';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: SupportAction;
  timestamp: Date;
}

interface SupportChatbotProps {
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export default function SupportChatbot({
  isOpen: controlledIsOpen,
  onToggle,
}: SupportChatbotProps) {
  const router = useRouter();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    if (onToggle) onToggle(val);
    setInternalIsOpen(val);
  };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  // Messages
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `### Bonjour ! Je suis l'Assistant Keo 👨‍👩‍👦
Je suis là pour vous aider à profiter au maximum de **Keo Family** (agenda, courses, repas, Doctolib...) et de **KeoPass**.

Posez-moi vos questions ou choisissez l'un des sujets rapides ci-dessous :`,
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Écouter un événement global pour ouvrir le chatbot depuis n'importe où
  useEffect(() => {
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('dar:open-chatbot', handleOpenEvent);
    return () => window.removeEventListener('dar:open-chatbot', handleOpenEvent);
  }, []);

  // Charger la clé API Gemini depuis le localStorage si configurée
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('keo_gemini_api_key') || '';
      if (savedKey) {
        setGeminiApiKey(savedKey);
        setTempApiKey(savedKey);
      }
    } catch (_) {}
  }, []);

  // Défilement automatique vers le bas lors de nouveaux messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus sur l'input lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      // 1. Recherche prioritaire dans la base de connaissances locale (Zéro latence)
      const localMatch = findBestAnswer(query);

      if (localMatch) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: localMatch.answer,
              action: localMatch.action,
              timestamp: new Date(),
            },
          ]);
          setLoading(false);
        }, 300);
        return;
      }

      // 2. Si aucune correspondance locale précise et que Gemini est configuré
      if (geminiApiKey) {
        const historyForGemini = messages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({
            role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
            text: m.text,
          }));

        const geminiReply = await askGeminiAssistant(query, geminiApiKey, historyForGemini);

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: geminiReply,
            timestamp: new Date(),
          },
        ]);
        setLoading(false);
        return;
      }

      // 3. Réponse d'aide par défaut si pas de clé Gemini
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: `Je n'ai pas trouvé de réponse directe dans la documentation locale pour : *« ${query} »*.
            
Voici les domaines sur lesquels je peux vous guider :
* 🩺 **Doctolib & Rendez-vous** : Synchronisation des fichiers \`.ics\`
* 🍽️ **Planning des repas** : Organisation sur 2 semaines (midi & soir)
* 👨‍🍳 **Recettes Cookidoo** : Import en 1 clic
* 🛒 **Liste de courses** : Tri par rayon et mode supermarché hors-ligne
* ✅ **Tâches partagées** : Répartition dans le foyer
* 👆 **Biométrie** : Empreinte digitale
* 🛡️ **KeoPass** : Gestionnaire de mots de passe

> 💡 *Astuce : Vous pouvez aussi activer l'IA avancée Google Gemini (gratuite) dans les options ⚙️ du chatbot ci-dessus pour des réponses encore plus poussées.*`,
            timestamp: new Date(),
          },
        ]);
        setLoading(false);
      }, 400);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Erreur :** ${err.message || 'Impossible de joindre le service d’assistance.'}`,
          timestamp: new Date(),
        },
      ]);
      setLoading(false);
    }
  };

  const handleActionClick = (action: SupportAction) => {
    switch (action.type) {
      case 'navigate_agenda':
        router.push('/agenda');
        setIsOpen(false);
        break;
      case 'navigate_planning':
        router.push('/planning');
        setIsOpen(false);
        break;
      case 'navigate_recettes':
        router.push('/recettes');
        setIsOpen(false);
        break;
      case 'navigate_courses':
        router.push('/courses');
        setIsOpen(false);
        break;
      case 'navigate_taches':
        router.push('/taches');
        setIsOpen(false);
        break;
      case 'navigate_settings':
        router.push('/settings');
        setIsOpen(false);
        break;
      case 'navigate_messages':
        router.push('/messages');
        setIsOpen(false);
        break;
      case 'navigate_documents':
        router.push('/documents');
        setIsOpen(false);
        break;
      case 'open_keopass':
        window.open('https://keopass.vercel.app', '_blank', 'noopener,noreferrer');
        break;
      case 'download_apk':
        window.open('https://github.com/heyhacene/dar/releases/latest', '_blank');
        break;
      default:
        if (action.url) {
          window.open(action.url, '_blank', 'noopener,noreferrer');
        }
        break;
    }
  };

  const handleSaveApiKey = () => {
    try {
      if (tempApiKey.trim()) {
        localStorage.setItem('keo_gemini_api_key', tempApiKey.trim());
        setGeminiApiKey(tempApiKey.trim());
      } else {
        localStorage.removeItem('keo_gemini_api_key');
        setGeminiApiKey('');
      }
      setShowConfig(false);
    } catch (_) {}
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: `Conversation réinitialisée ! Comment puis-je vous aider ?`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <>
      {/* BOUTON FLOTTANT D'OUVERTURE (PLU HAUT QUE LA BOTTOMNAV SUR MOBILE) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-40 bg-gradient-to-r from-primary-600 to-amber-500 hover:from-primary-700 hover:to-amber-600 text-white rounded-full p-3 sm:px-4 sm:py-3 shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-2 border-2 border-white/40 dark:border-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/30 group animate-bounce-subtle"
          aria-label="Ouvrir l'Assistant Keo Support"
          title="Besoin d'aide ? Discuter avec l'Assistant Keo"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
            </span>
          </div>
          <span className="font-bold text-xs sm:text-sm tracking-wide">
            Assistant Keo
          </span>
        </button>
      )}

      {/* BOÎTE DE DIALOGUE CHATBOT */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-20 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 md:w-[420px] max-h-[82vh] h-[580px] z-50 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-primary-600 via-orange-600 to-amber-500 text-white px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm leading-none">Assistant Keo</h3>
                  <span className="text-[10px] bg-white/25 px-1.5 py-0.5 rounded-full font-semibold">
                    Support Family
                  </span>
                </div>
                <p className="text-[11px] text-white/80 leading-tight mt-0.5">
                  {geminiApiKey ? 'IA Gemini + Documentation' : 'Documentation locale & FAQ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`p-1.5 rounded-xl transition ${
                  showConfig ? 'bg-white/30 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title="Paramètres de l'Assistant"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
                title="Effacer l'historique"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PANNEAU DE CONFIGURATION API (OPTIONNEL GEMINI) */}
          {showConfig && (
            <div className="bg-amber-50/95 dark:bg-slate-800/95 p-3.5 border-b border-amber-200 dark:border-slate-700 text-xs text-gray-800 dark:text-gray-200 transition-all">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-400 mb-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Activer l'IA Google Gemini (Optionnel & Gratuit)</span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                Par défaut, l'Assistant utilise la base de connaissances locale (100% hors-ligne et gratuit). Pour lui poser des questions libres, ajoutez votre clé API gratuite Google AI Studio :
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Collez votre clé API Gemini (AIzaSy...)"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition text-xs"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* SUGGESTIONS RAPIDES EN HAUT */}
          <div className="bg-gray-50/90 dark:bg-slate-950/40 px-3 py-2 border-b border-gray-100 dark:border-slate-800 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 flex-shrink-0 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> Questions fréquentes :
            </span>
            {SUPPORT_FAQS.slice(0, 4).map((faq) => (
              <button
                key={faq.id}
                onClick={() => handleSendMessage(faq.quickQuestion)}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-full text-gray-700 dark:text-gray-300 transition whitespace-nowrap shadow-2xs"
              >
                {faq.quickQuestion}
              </button>
            ))}
          </div>

          {/* ZONE DES MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/50 dark:bg-slate-900/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-slate-700'
                  }`}
                >
                  <div className="prose prose-xs dark:prose-invert max-w-none space-y-1.5">
                    {msg.text.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ')) {
                        return (
                          <h4
                            key={pIdx}
                            className="font-bold text-sm text-primary-600 dark:text-primary-400 mb-1"
                          >
                            {paragraph.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (paragraph.startsWith('* ') || paragraph.startsWith('- ')) {
                        const items = paragraph.split('\n');
                        return (
                          <ul key={pIdx} className="list-disc pl-4 space-y-1">
                            {items.map((it, iIdx) => (
                              <li key={iIdx}>
                                <FormatFormattedText text={it.replace(/^[\*\-]\s+/, '')} />
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      if (/^\d+\.\s/.test(paragraph)) {
                        const items = paragraph.split('\n');
                        return (
                          <ol key={pIdx} className="list-decimal pl-4 space-y-1">
                            {items.map((it, iIdx) => (
                              <li key={iIdx}>
                                <FormatFormattedText text={it.replace(/^\d+\.\s+/, '')} />
                              </li>
                            ))}
                          </ol>
                        );
                      }
                      if (paragraph.startsWith('> ')) {
                        return (
                          <blockquote
                            key={pIdx}
                            className="border-l-2 border-primary-500 pl-2.5 py-0.5 text-gray-600 dark:text-gray-300 italic text-[11px]"
                          >
                            <FormatFormattedText text={paragraph.replace(/^>\s*/, '')} />
                          </blockquote>
                        );
                      }
                      return (
                        <p key={pIdx}>
                          <FormatFormattedText text={paragraph} />
                        </p>
                      );
                    })}
                  </div>

                  {/* BOUTON D'ACTION DIRECTE DANS LE MESSAGE */}
                  {msg.action && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/80 flex items-center justify-start">
                      <button
                        onClick={() => handleActionClick(msg.action!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-600 to-amber-500 hover:from-primary-700 hover:to-amber-600 text-white font-bold rounded-xl text-[11px] shadow-xs transition transform hover:scale-[1.02]"
                      >
                        {getActionIcon(msg.action.type)}
                        <span>{msg.action.label}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs py-1">
                <div className="w-6 h-6 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center border border-gray-200 dark:border-slate-700">
                  <Bot className="w-3.5 h-3.5 text-primary-600 animate-pulse" />
                </div>
                <div className="flex gap-1 items-center bg-white dark:bg-slate-800 px-3 py-2 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xs">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* FORMULAIRE DE SAISIE */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Posez une question sur Keo Family..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white transition shadow-xs flex-shrink-0"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// Fonction utilitaire pour choisir l'icône d'action
function getActionIcon(type: SupportAction['type']) {
  switch (type) {
    case 'navigate_agenda':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'navigate_planning':
      return <Utensils className="w-3.5 h-3.5" />;
    case 'navigate_recettes':
      return <BookOpen className="w-3.5 h-3.5" />;
    case 'navigate_courses':
      return <ShoppingCart className="w-3.5 h-3.5" />;
    case 'navigate_taches':
      return <CheckSquare className="w-3.5 h-3.5" />;
    case 'navigate_settings':
      return <Settings className="w-3.5 h-3.5" />;
    case 'navigate_messages':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'open_keopass':
      return <Shield className="w-3.5 h-3.5" />;
    case 'download_apk':
      return <Download className="w-3.5 h-3.5" />;
    default:
      return <ExternalLink className="w-3.5 h-3.5" />;
  }
}

// Formatage simple pour le gras et le code en ligne
function FormatFormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-semibold text-gray-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono text-primary-600 dark:text-primary-300"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
}
