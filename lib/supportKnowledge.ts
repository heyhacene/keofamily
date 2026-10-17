/**
 * KEO FAMILY / DAR — BASE DE CONNAISSANCES ASSISTANT SUPPORT
 * Moteur hybride :
 * 1. Recherche sémantique locale hors-ligne ultra-rapide (Zéro coût, 100% privé)
 * 2. Moteur IA générative optionnel via Google Gemini (API gratuite Google AI Studio)
 */

export interface SupportAction {
  label: string;
  type:
    | 'navigate_agenda'
    | 'navigate_planning'
    | 'navigate_recettes'
    | 'navigate_courses'
    | 'navigate_taches'
    | 'navigate_settings'
    | 'navigate_messages'
    | 'navigate_documents'
    | 'open_keopass'
    | 'download_apk';
  url?: string;
}

export interface SupportFAQ {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  quickQuestion: string;
  action?: SupportAction;
}

export const SUPPORT_FAQS: SupportFAQ[] = [
  {
    id: 'family-documents-vault',
    title: 'Coffre de Documents Familiaux Sécurisé',
    quickQuestion: 'Où retrouver les passeports, cartes vitales et attestations de la famille ?',
    keywords: [
      'document',
      'documents',
      'coffre',
      'passeport',
      'carte vitale',
      'identite',
      'bail',
      'facture',
      'assurance',
      'ordonnance',
      'certificat',
      'scolaire',
      'permis',
      'carte grise',
    ],
    answer: `### 🗂️ Coffre de Documents Familiaux Sécurisé

Keo Family intègre désormais un coffre numérique sécurisé pour centraliser tous les documents importants du foyer :

1. **Catégories préconfigurées :**
   * 🪪 **Identité & Famille :** Passeports, cartes d'identité, livret de famille, actes.
   * 🏥 **Santé & Médical :** Cartes Vitales, ordonnances, attestations mutuelle.
   * 🏫 **Scolarité :** Attestations scolaires, cantine, inscriptions.
   * 🏠 **Logement :** Baux, quittances, factures EDF/gaz/eau.
   * 🚗 **Véhicules :** Cartes grises, permis, contrôles techniques.
   * 🛡️ **Assurances :** Responsabilité civile, habitation, auto.
2. **Alertes d'expiration automatiques :**
   * L'application vous alerte 90 jours avant l'expiration d'un passeport, permis ou contrat.
3. **Disponible 100% hors-ligne :**
   * Vos documents restent consultables même sans réseau (chez le médecin, à l'aéroport ou au garage).`,
    action: {
      label: 'Ouvrir le Coffre de Documents',
      type: 'navigate_documents',
    },
  },
  {
    id: 'smart-push-notifications',
    title: 'Notifications Push instantanées (Courses, Repas & Agenda)',
    quickQuestion: 'Comment fonctionnent les alertes de courses et les rappels de repas ?',
    keywords: [
      'notification',
      'notifications',
      'alerte',
      'alertes',
      'push',
      'rappel',
      'courses',
      'repas',
      'menu',
      'agenda',
      'volet',
      'sonnerie',
    ],
    answer: `### 🔔 Notifications Push Instantanées & Intelligentes

Keo Family vous tient informé en temps réel des activités du foyer :

1. **🛒 Courses collaboratives :**
   * Quand un membre coche un article au supermarché ou ajoute un besoin urgent, toute la famille est synchronisée instantanément.
2. **🍽️ Rappels du menu du jour :**
   * Recevez une notification discrète vers midi et en fin d'après-midi pour vous rappeler ce qui est prévu au planning des repas !
3. **📅 Rappels de rendez-vous :**
   * Ne manquez aucun rendez-vous médical Doctolib ou événement familial important.
4. **Réglages personnalisés :**
   * Personnalisez le volet de notification et choisissez votre mélodie préférée dans les Paramètres.`,
    action: {
      label: 'Gérer mes notifications',
      type: 'navigate_settings',
    },
  },
  {
    id: 'doctolib-ics-sync',
    title: 'Synchronisation Doctolib & Rendez-vous (.ics)',
    quickQuestion: 'Comment synchroniser mes rendez-vous Doctolib dans Keo Family ?',
    keywords: [
      'doctolib',
      'ics',
      'agenda',
      'calendrier',
      'rendez-vous',
      'rdv',
      'medecin',
      'docteur',
      'dentiste',
      'import',
      'importer',
      'partager',
      'sms',
    ],
    answer: `### 🩺 Synchronisation facile des rendez-vous Doctolib

Keo Family intègre un récepteur natif pour vos fichiers de rendez-vous médicaux :

1. **Depuis votre confirmation Doctolib (SMS ou Email) :**
   * Cliquez sur le lien **« Ajouter à mon calendrier »** ou téléchargez la pièce jointe \`.ics\`.
   * Sur votre smartphone Android, choisissez **Ouvrir avec Keo Family** ou appuyez sur **Partager > Keo Family**.
2. **Dans l’application :**
   * Keo Family lit instantanément le fichier, extrait le praticien, l'adresse, la date et l'horaire précis.
   * L'événement est automatiquement enregistré dans l'**Agenda Familial** et synchronisé sur les téléphones de tous les membres du foyer !
3. **Depuis l’onglet Agenda :**
   * Vous pouvez également appuyer sur **« Importer un fichier .ics »** pour charger n'importe quel calendrier d'activités scolaires ou sportives.`,
    action: {
      label: 'Accéder à l’Agenda familial',
      type: 'navigate_agenda',
    },
  },
  {
    id: 'planning-2-semaines',
    title: 'Planning des repas sur 2 semaines',
    quickQuestion: 'Comment organiser les repas sur 2 semaines complètes ?',
    keywords: [
      'planning',
      'repas',
      'menu',
      'menus',
      'semaine',
      '2 semaines',
      'midi',
      'soir',
      'dejeuner',
      'diner',
      'organiser',
      'manger',
    ],
    answer: `### 🍽️ Planning des repas étendu (14 jours)

Fini le casse-tête du « qu'est-ce qu'on mange ce soir ? » :

* **Sélecteur 2 semaines :**
  En haut de l'écran **Repas**, basculez entre les onglets **« 📅 Cette semaine »** et **« 🔮 Semaine prochaine »**.
* **Attribution des recettes :**
  Pour chaque jour (midi ou soir), cliquez sur **« + Ajouter un repas »** pour piocher dans votre livre de recettes ou taper une idée rapide.
* **Impact sur les courses :**
  Tous les ingrédients des recettes planifiées s'ajoutent automatiquement à votre **Liste de courses** avec le bon dosage !`,
    action: {
      label: 'Ouvrir le Planning des repas',
      type: 'navigate_planning',
    },
  },
  {
    id: 'cookidoo-thermomix-import',
    title: 'Importer des recettes Cookidoo & Thermomix',
    quickQuestion: 'Comment importer une recette depuis Cookidoo ou un site web ?',
    keywords: [
      'cookidoo',
      'thermomix',
      'recette',
      'recettes',
      'importer',
      'cuisine',
      'marmiton',
      'lien',
      'coller',
      'url',
      'ingredients',
    ],
    answer: `### 👨‍🍳 Importer une recette Cookidoo / Web en 1 clic

Vous pouvez intégrer vos recettes préférées sans rien recopier manuellement :

1. Dans **Cookidoo** ou sur votre site de cuisine, copiez l'URL de la recette (ou partagez le lien).
2. Rendez-vous dans **Repas > Recettes** dans Keo Family.
3. En haut, cliquez sur la bannière **« 📥 Importer depuis Cookidoo »**.
4. Collez le lien ou le texte complet :
   * L'algorithme intelligent sépare automatiquement les **ingrédients**, les **quantités** et les **étapes de préparation**.
   * Vous pouvez ensuite l'ajouter à votre planning en un seul clic !`,
    action: {
      label: 'Voir mes Recettes',
      type: 'navigate_recettes',
    },
  },
  {
    id: 'courses-magasin-offline',
    title: 'Liste de courses intelligente & Mode Hors-ligne',
    quickQuestion: 'Comment utiliser la liste de courses en supermarché sans réseau ?',
    keywords: [
      'courses',
      'liste',
      'supermarche',
      'magasin',
      'offline',
      'hors-ligne',
      'rayon',
      'rayons',
      'cocher',
      'acheter',
      'reseau',
    ],
    answer: `### 🛒 La Liste de courses partagée au supermarché

La liste de courses de Keo Family est conçue pour la vraie vie :

* **Classement par rayon :**
  Vos articles sont automatiquement regroupés par secteur (Fruits & Légumes, Frais, Épicerie, Boissons, Entretien...) pour vous faire gagner un temps précieux en magasin.
* **Fonctionnement 100% Hors-ligne :**
  Même dans un supermarché sans aucune connexion 4G/5G, la liste reste consultable et vous pouvez cocher vos articles sans blocage.
* **Synchronisation dès le retour du réseau :**
  Dès que votre téléphone retrouve une connexion, vos coches et ajouts sont synchronisés avec les autres membres de la famille.
* **Filtre par période :**
  Vous pouvez afficher les courses pour **« Les 2 semaines »**, **« Cette semaine »** ou **« Semaine prochaine »**.`,
    action: {
      label: 'Consulter la Liste de courses',
      type: 'navigate_courses',
    },
  },
  {
    id: 'taches-partagees',
    title: 'Gestion des tâches familiales',
    quickQuestion: 'Comment répartir et suivre les corvées et tâches familiales ?',
    keywords: [
      'tache',
      'taches',
      'corvee',
      'menage',
      'attribuer',
      'famille',
      'responsable',
      'enfants',
      'partage',
      'suivi',
    ],
    answer: `### ✅ Organiser la vie du foyer avec les Tâches

Keo Family permet de responsabiliser chacun avec bienveillance :

1. Allez dans l'onglet **Tâches** (icône de case cochée).
2. Cliquez sur **« Nouvelle tâche »** :
   * Donnez un titre (ex : *Sortir les poubelles*, *Ranger les chambres*, *Arroser les plantes*).
   * Attribuez la tâche au membre de votre choix (Sarah, Hacene, les enfants...).
   * Définissez une date limite si besoin.
3. Lorsque la tâche est faite, il suffit de la cocher : l'historique se met à jour pour toute la famille.`,
    action: {
      label: 'Accéder aux Tâches',
      type: 'navigate_taches',
    },
  },
  {
    id: 'biometrie-dar',
    title: 'Connexion par empreinte digitale dans Keo Family',
    quickQuestion: 'Comment activer mon empreinte pour ouvrir Keo Family rapidement ?',
    keywords: [
      'empreinte',
      'biometrie',
      'biometrique',
      'doigt',
      'touch id',
      'face id',
      'connexion',
      'authentification',
      'rapide',
      'securite',
    ],
    answer: `### 👆 Connexion rapide par empreinte digitale

Pour ne plus avoir à retaper le mot de passe familial à chaque ouverture :

1. Ouvrez les **Paramètres** (icône roue crantée en haut à droite ou onglet Famille > Paramètres).
2. Rendez-vous dans la section **« Empreinte digitale & Biométrie »**.
3. Activez le bouton bascule :
   * Sur Android, l'application utilise **Android Keystore** pour vérifier votre empreinte de manière hautement sécurisée.
   * Sur le Web/PC, le système utilise **Windows Hello** ou **Touch ID**.
4. Au prochain lancement, posez simplement votre doigt sur le capteur pour entrer immédiatement !`,
    action: {
      label: 'Ouvrir les Paramètres',
      type: 'navigate_settings',
    },
  },
  {
    id: 'mise-a-jour-apk',
    title: 'Télécharger la dernière version de Keo Family',
    quickQuestion: 'Comment mettre à jour Keo Family vers la dernière version Android ?',
    keywords: [
      'maj',
      'mise a jour',
      'telecharger',
      'apk',
      'install',
      'installer',
      'github',
      'version',
      'nouvelle version',
      'release',
    ],
    answer: `### 🚀 Mettre à jour Keo Family sur Android

L'application bénéficie de mises à jour régulières avec de nouvelles fonctionnalités :

* **Notification automatique :**
  Lorsqu'une nouvelle version est disponible, une bannière orange d'alerte apparaît en haut de votre écran vous invitant à la télécharger.
* **Téléchargement manuel direct :**
  Vous pouvez à tout moment récupérer la dernière mouture officielle directement depuis notre espace GitHub Releases sécurisé.
* **Installation en 3 clics :**
  Téléchargez le fichier \`KeoFamily.apk\`, ouvrez la notification de téléchargement sur votre smartphone et cliquez sur **« Mettre à jour »**. Vos données et plannings sont conservés à 100% !`,
    action: {
      label: 'Télécharger la dernière version APK',
      type: 'download_apk',
      url: 'https://github.com/heyhacene/dar/releases/latest',
    },
  },
  {
    id: 'keopass-integration',
    title: 'Découvrir KeoPass (Gestionnaire de Mots de Passe)',
    quickQuestion: 'Qu’est-ce que KeoPass et comment y accéder ?',
    keywords: [
      'keopass',
      'pass',
      'mot de passe',
      'mdp',
      'coffre',
      'securite',
      'passvault',
      'gestionnaire',
      'web',
    ],
    answer: `### 🛡️ KeoPass : Votre coffre-fort de mots de passe

**KeoPass** est le gestionnaire de mots de passe souverain et ultra-sécurisé de la suite Keo :

* **Chiffrement militaire Zero-Knowledge :**
  Vos identifiants, codes 2FA et notes secrètes sont chiffrés en **AES-256-GCM**. Même les serveurs ne peuvent pas lire vos secrets.
* **Import universel :**
  Importez tous vos mots de passe depuis Google Chrome, Firefox, Total Adblock ou Bitwarden en 1 clic.
* **Déverrouillage biométrique :**
  Accès instantané par empreinte digitale sur votre smartphone.
* **Disponible sur Android et sur le Web :**
  Accessible depuis n'importe quel navigateur sur \`https://keopass.vercel.app\`.`,
    action: {
      label: 'Ouvrir KeoPass Web',
      type: 'open_keopass',
      url: 'https://keopass.vercel.app',
    },
  },
  {
    id: 'sauvegarde-restauration',
    title: 'Sauvegarder et Exporter mes données',
    quickQuestion: 'Comment faire une sauvegarde complète de mes recettes et plannings ?',
    keywords: [
      'sauvegarde',
      'exporter',
      'json',
      'backup',
      'restaurer',
      'importer',
      'securite',
      'perdre',
    ],
    answer: `### 💾 Sauvegarde manuelle et Sérénité

En plus de la synchronisation continue sur le Cloud Supabase, vous gardez le contrôle total de vos données :

1. Allez dans **Paramètres** (icône roue crantée).
2. Descendez jusqu'à la section **« Sauvegarde manuelle (JSON) »**.
3. Cliquez sur **« Exporter »** : un fichier \`.json\` contenant l'intégralité de vos recettes, listes et plannings est téléchargé sur votre appareil.
4. Pour restaurer vos données sur un nouvel appareil, cliquez simplement sur **« Importer »** et sélectionnez ce fichier.`,
    action: {
      label: 'Aller aux Sauvegardes',
      type: 'navigate_settings',
    },
  },
];

/**
 * Moteur de recherche sémantique locale :
 * Scanne les mots-clés et titres avec score pondéré.
 */
export function findBestAnswer(userQuery: string): SupportFAQ | null {
  const normalized = userQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!normalized) return null;

  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  let bestMatch: SupportFAQ | null = null;
  let highestScore = 0;

  for (const faq of SUPPORT_FAQS) {
    let score = 0;

    for (const keyword of faq.keywords) {
      const normKey = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (normalized.includes(normKey)) {
        score += 8;
      }
      for (const w of words) {
        if (normKey.includes(w) || w.includes(normKey)) {
          score += 4;
        }
      }
    }

    const normTitle = faq.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const w of words) {
      if (normTitle.includes(w)) {
        score += 5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }

  // Seuil de pertinence minimum
  return highestScore >= 6 ? bestMatch : null;
}

/**
 * Appel API Google Gemini (1.5 Flash) côté client
 */
export async function askGeminiAssistant(
  userQuery: string,
  apiKey: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Clé API Gemini non fournie');
  }

  const systemInstruction = `Tu es l'Assistant Support officiel de Keo Family (aussi appelée Dar), une application familiale privée et bienveillante.
Tes missions :
1. Aider les membres de la famille à tirer le meilleur parti de l'application :
   - Agenda familial partagé et import automatique des rendez-vous Doctolib (.ics).
   - Planning des repas étendu sur 2 semaines (midi & soir).
   - Recettes de cuisine avec import automatique depuis Cookidoo ou des sites web.
   - Liste de courses classée par rayon avec mode hors-ligne supermarché.
   - Gestion des corvées et tâches familiales assignées à chacun.
   - Messagerie familiale et alertes d'urgence.
   - Connexion rapide par empreinte biométrique (Android Keystore).
   - Mises à jour APK via GitHub Releases.
   - Lien avec le gestionnaire de mots de passe KeoPass (https://keopass.vercel.app).
2. Sois toujours chaleureux, bienveillant, concis, structuré (puces, gras) et rassurant.
3. Si la question dépasse le cadre de Keo Family ou KeoPass, réponds poliment en recentrant sur les usages de l'application.`;

  const contents = [
    ...history.slice(-6).map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userQuery }],
    },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erreur API Gemini (${response.status})`
    );
  }

  const data = await response.json();
  const candidateText =
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Désolé, je n'ai pas pu formuler de réponse. N'hésitez pas à reformuler votre question.";

  return candidateText;
}
