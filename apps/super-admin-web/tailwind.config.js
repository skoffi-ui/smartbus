/**
 * Tailwind pour le Super Admin.
 *
 * Rampes `brand`/`navy` alignées sur les tokens M3 clair/sombre partagés
 * avec school-web (voir apps/super-admin-web/src/index.css `:root` /
 * `:root.dark`), pour que les classes qui restent en `bg-navy-900`/
 * `bg-brand-500` etc. (non encore migrées vers les classes maison)
 * suivent le thème actif — y compris avec un modificateur d'opacité
 * (`bg-navy-800/50`), grâce au format `rgb(var(--x) / <alpha-value>)`.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /*
         * `brand-300` reste clair (texte sur fond sombre, ex. label
         * "Super Admin"). `brand-400/500/600` restent volontairement plus
         * saturés/sombres dans les deux thèmes : ce sont les seules teintes
         * de la rampe utilisées comme fond plein sous un texte blanc (nav
         * actif, badge dégradé) — un ton clair type M3 "primary" y
         * casserait le contraste, y compris en thème clair.
         */
        brand: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b8d1ff',
          300: 'var(--accent-primary)', // texte/bordures
          400: 'rgb(var(--container-hover-rgb) / <alpha-value>)',
          500: 'rgb(var(--container-rgb) / <alpha-value>)', // fond plein (nav actif) + texte blanc
          600: 'rgb(var(--container-rgb) / <alpha-value>)',
          700: '#22395c',
          800: '#182740',
          900: '#10192a',
        },
        navy: {
          50: '#f3f4f6',
          100: '#e2e4e8',
          200: '#c7cad1',
          300: 'var(--text-secondary)',
          400: 'var(--text-secondary)',
          500: '#5c5f68',
          600: '#3d3f46',
          700: '#2f3136',
          800: 'rgb(var(--surface-rgb) / <alpha-value>)', // surface (--bg-secondary)
          900: 'rgb(var(--bg-primary-rgb) / <alpha-value>)', // background (--bg-primary)
        }
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        // Valeurs statiques (Tailwind ne théise pas boxShadow) : assez
        // discrètes pour rester correctes en clair comme en sombre.
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.18)',
      }
    },
  },
  plugins: [],
}
