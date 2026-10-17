# 🏡 Dar — Espace & Portail Familial

Application web moderne, privée, responsive et PWA conçue pour la famille Otsmane, déployable sur **Vercel** et reliée à **`dar.otsmane.fr`** chez **IONOS**.

---

## 🚀 Démarrage rapide en local

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```

3. Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.
   - Mot de passe par défaut : `famille2025` (modifiable dans `.env.local` et sur Vercel).

---

## 🌐 Déploiement sur Vercel

1. Poussez ce dossier sur un dépôt GitHub (privé) nommé par exemple **`dar`** :
   ```bash
   git init
   git add .
   git commit -m "Initial commit Dar"
   git branch -M main
   git remote add origin https://github.com/VOTRE_USER/dar.git
   git push -u origin main
   ```
2. Connectez le dépôt sur [Vercel](https://vercel.com).
3. Ajoutez les variables d'environnement dans les paramètres Vercel :
   - `APP_PASSWORD` : votre mot de passe secret
   - `AUTH_SECRET` : une clé secrète aléatoire
   - `GOOGLE_APPS_SCRIPT_URL` : (optionnel) URL du script Google Drive
4. Cliquez sur **Deploy**.

---

## 🔗 Relier le domaine `dar.otsmane.fr` chez IONOS

1. Dans **Vercel** : **Settings > Domains**, ajoutez **`dar.otsmane.fr`**.
2. Dans votre espace **IONOS** :
   - Rendez-vous dans **Domaines & SSL** > sélectionnez **`otsmane.fr`** > onglet **DNS**.
   - Cliquez sur **Ajouter un enregistrement** :
     - **Type** : `CNAME`
     - **Nom d'hôte** : `dar`
     - **Pointe vers** : `cname.vercel-dns.com`
     - **TTL** : 1 heure
3. Vercel détectera la redirection et délivrera automatiquement le certificat SSL sécurisé (HTTPS).

