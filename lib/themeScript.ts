// Fichier sans 'use client' : importé par le layout serveur.
export const THEME_STORAGE_KEY = 'dar_theme';

/**
 * Script exécuté immédiatement dans <head> avant le rendu
 * pour éviter tout flash blanc et garantir que le mode sombre est actif dès le départ.
 */
export const themeInitScript = `(function(){
  try {
    var getCookie = function(name) {
      var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };
    var p = localStorage.getItem('${THEME_STORAGE_KEY}') || getCookie('${THEME_STORAGE_KEY}') || 'system';
    var isDark = p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#ee7318');
  } catch(e) {}
})();`;
