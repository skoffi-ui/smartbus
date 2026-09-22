/**
 * Tailwind pour l'Espace École.
 *
 * Les pages de ce frontend étaient écrites en classes Tailwind depuis le départ,
 * y compris avec des valeurs arbitraires (`text-[#2563EB]`, `h-[calc(100vh-100px)]`),
 * mais Tailwind n'avait jamais été installé : toutes ces classes étaient inertes et
 * plusieurs pages s'affichaient sans aucun style.
 *
 * Deux précautions pour ne rien casser de l'existant :
 *  - `preflight: false` : le reset global de Tailwind n'est pas appliqué, car les
 *    pages déjà en place (Login, Dashboard, LiveTracking…) s'appuient sur les
 *    styles de `index.css` et sur des styles en ligne.
 *  - `@tailwind utilities` est placé AVANT les utilitaires maison dans
 *    `index.css`, si bien que les correspondances thémées (`text-slate-600`
 *    → `var(--text-secondary)`) continuent de primer.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // L'application bascule en sombre via `:root.dark`, pas via l'OS.
  darkMode: 'class',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Couleurs du thème, pour que les classes Tailwind restent cohérentes
        // avec les variables CSS déjà utilisées partout.
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
