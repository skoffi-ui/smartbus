/**
 * Gestion du thème clair/sombre M3 (voir design.md).
 *
 * `:root` porte les valeurs claires par défaut ; `:root.dark` les redéfinit
 * en sombre (index.css). Ce fichier ne fait qu'appliquer/persister le choix,
 * la peau visuelle vient entièrement des variables CSS.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // stockage indisponible (navigation privée, etc.)
  }
}

/** Sombre par défaut si l'utilisateur n'a encore rien choisi (recommandation M3/XR). */
export function getInitialTheme(): Theme {
  return readStored() ?? 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* stockage indisponible : le choix ne persistera pas, sans plus de conséquence */
  }
}
