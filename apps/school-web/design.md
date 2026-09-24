# 🥽 Android XR — Système de Design
> Source : [developer.android.com/xr](https://developer.android.com/xr)
> Base : **Material Design 3 (M3)** étendu pour le spatial computing

---

## 1. 🎨 Palette de Couleurs

Android XR repose sur le système de couleurs **sémantique et dynamique** de Material Design 3. Les couleurs ne sont pas des valeurs hex fixes, mais des **rôles sémantiques** générés dynamiquement à partir d'une couleur source (seed color).

### Rôles de couleurs principaux (Color Roles)

| Rôle | Jeton (ColorScheme) | Usage |
|---|---|---|
| **Primary** | colorScheme.primary | Couleur de marque principale, boutons CTA, FABs, états actifs |
| **On Primary** | colorScheme.onPrimary | Texte / icônes sur fond Primary |
| **Secondary** | colorScheme.secondary | Couleur d'accentuation secondaire, composants moins importants |
| **On Secondary** | colorScheme.onSecondary | Texte / icônes sur fond Secondary |
| **Tertiary** | colorScheme.tertiary | 3ème couleur pour contraster avec Primary et Secondary |
| **Surface** | colorScheme.surface | Fond des cartes, panneaux, grandes zones |
| **On Surface** | colorScheme.onSurface | Texte / icônes sur fond Surface |
| **Surface Variant** | colorScheme.surfaceVariant | Fonds alternatifs, séparateurs, champs de saisie |
| **Background** | colorScheme.background | Fond d'écran principal de l'application |
| **Outline** | colorScheme.outline | Bordures essentielles (champs de texte, séparateurs) |
| **Error** | colorScheme.error | État d'erreur |

### Règles spécifiques XR pour les couleurs

- **Éviter le noir pur (#000000)** : En XR/AR, le noir pur peut s'afficher comme transparent. Utiliser des gris sombres.
- **Couleur additive** : Les couleurs plus sombres émettent moins de lumière, réduisent leur opacité perçue en passthrough.
- **Thème sombre recommandé** : Les environnements XR favorisent les fonds sombres pour réduire la fatigue oculaire.
- **Accents limités et désaturés** : Peu de couleurs d'accent, légèrement désaturées sur fond sombre.
- **Contraste adaptatif** : Le système peut assombrir automatiquement les surfaces si l'environnement physique est lumineux.
- **Couleurs vives et à fort contraste** : Les éléments UI doivent se démarquer sur des arrière-plans variés.

### Outil recommandé

Material Theme Builder (https://m3.material.io/styles/color/theme-builder) — génère une palette complète et accessible à partir d'une couleur de marque.

---

## 2. 🔤 Typographie

### Polices recommandées

| Police | Usage |
|---|---|
| **Roboto** (variable font) | Police système Android par défaut. Haute lisibilité. Recommandée pour XR. |
| **Google Sans** | Branding et interface système Google. Variable font. |

### Échelle typographique M3

| Rôle | Taille | Poids | Usage |
|---|---|---|---|
| Display Large | 57sp | Regular (400) | Textes très courts et impactants, numéraux |
| Display Medium | 45sp | Regular (400) | Titres en une d'écran |
| Display Small | 36sp | Regular (400) | Titres larges |
| Headline Large | 32sp | Regular (400) | Texte court, haute emphase |
| Headline Medium | 28sp | Regular (400) | En-têtes de section |
| Headline Small | 24sp | Regular (400) | Sous-titres importants |
| Title Large | 22sp | Regular (400) | Navigation, titre de page |
| Title Medium | 16sp | Medium (500) | Titres de composants |
| Title Small | 14sp | Medium (500) | Titres secondaires |
| Body Large | 16sp | Regular (400) | Contenu principal lisible |
| Body Medium | 14sp | Regular (400) | Corps de texte standard |
| Body Small | 12sp | Regular (400) | Corps de texte secondaire |
| Label Large | 14sp | Medium (500) | Texte dans les boutons |
| Label Medium | 12sp | Medium (500) | Labels de composants |
| Label Small | 11sp | Medium (500) | Annotations, captions |

> Implémentation Compose : MaterialTheme.typography.displayLarge, .headlineMedium, .bodyLarge, etc.

---

## 3. 🔘 Boutons (Buttons)

### Types de boutons M3

| Type | Apparence | Usage |
|---|---|---|
| **Filled Button** | Fond coloré (Primary), border-radius 24dp | Action principale |
| **Filled Tonal Button** | Fond tonal (Surface Variant), border-radius 24dp | Action secondaire |
| **Outlined Button** | Bordure (Outline), fond transparent, border-radius 24dp | Action alternative |
| **Text Button** | Texte seul (Primary), sans fond ni bordure | Action tertiaire, lien |
| **Elevated Button** | Fond Surface avec ombre, border-radius 24dp | Fond complexe |
| **FAB** | Fond Secondary Container, icône, border-radius 16dp | Action principale de l'écran |
| **Extended FAB** | FAB + label texte | FAB avec libellé |

### Spécifications des boutons

| Propriété | Valeur |
|---|---|
| Border Radius | 24dp (pill shape) |
| Hauteur minimale | 40dp |
| Padding horizontal | 24dp |
| Hit target (cible gestuelle) | Minimum 48x48dp — critique pour XR hand-tracking |
| Typographie | Label Large — 14sp, Medium (500) |
| Taille icône | 18dp (si présente) |

### États des boutons

| État | Comportement visuel |
|---|---|
| Default | Style de base |
| Hover | Overlay de 8% sur la couleur de surface |
| Focus | Overlay de 12% + indicateur de focus |
| Pressed | Overlay de 12% |
| Disabled | 38% opacité couleur / 12% opacité fond |

> ⚠️ XR : Hit targets larges pour eye-tracking, hand-tracking et gesture. Feedback visuel obligatoire.

---

## 4. 🏗️ Composants Spatiaux XR

### Spatial Panels (Panneaux spatiaux)
- **Rôle** : Conteneur principal de l'interface XR. Éléments UI sur des panneaux flottants 3D.
- **Comportement** : Elevation 3D pour hiérarchie. Adaptation à l'éclairage de l'environnement virtuel.
- **Implémentation** : SpatialPanel via Jetpack Compose for XR.

### Orbiters
- **Rôle** : Éléments UI flottants ancrés à un contenu spatial.
- **Usage** : Actions rapides ou contrôles restant accessibles sans obstruer la vue principale.
- **Implémentation** : Composable Orbiter.

### Subspaces
- **Rôle** : Partitions dans l'espace 3D pour rendre du contenu spatialisé.
- **Types** : Subspace, PlanarEmbeddedSubspace.

### Profondeur (Depth)
- Modificateur depth en Compose pour présence physique des panneaux.
- Les composants doivent être conçus avec l'axe Z en tête (contrairement au 2D plat).

---

## 5. 📐 Mise en Page & Ergonomie

- Placer le contenu **au centre du champ de vision** (minimiser les mouvements tête/corps).
- Concevoir pour positions variées : **assis, debout, allongé**.
- Utiliser l'**elevation** pour créer la hiérarchie dans l'espace 3D.
- Grille **8dp** standard Material Design.
- Contenu conçu pour être lisible à **différentes distances**.

---

## 6. 🎭 Thème & Mode

| Aspect | Recommandation XR |
|---|---|
| Mode | Thème sombre préféré (réduit la fatigue oculaire) |
| Fond | Gris sombre — pas de noir pur (#000000) |
| Palette | Focalisée, peu de couleurs, accents désaturés |
| Contraste | Respecter les ratios WCAG sur fond sombre |
| Animations | Tester le confort — éviter les mouvements causant la nausée |

---

## 7. 🖼️ Iconographie

- Icônes **Material Symbols** (variable font).
- Taille minimum recommandée : **24dp** pour la lisibilité en XR.
- Style : **Outlined** ou **Rounded** pour meilleure visibilité sur fond sombre.

---

## 8. 🔄 Interactions & Animations

| Principe | Détails |
|---|---|
| Feedback visuel | Obligatoire pour chaque interaction (hover, focus, press) |
| Hand tracking | Hit targets larges (min 48x48dp) |
| Eye tracking | Indicateurs de focus clairs |
| Animations | Douces, non perturbantes — tester le confort |
| Transitions | M3 : Fade, Shared Axis, Container Transform |
| Motion sickness | Éviter les déplacements rapides ou animations de parallaxe trop prononcées |

---

## 9. 🛠️ Ressources & Outils

| Ressource | Lien |
|---|---|
| Android XR Developer | https://developer.android.com/xr |
| Material Design for XR | https://m3.material.io |
| Material Theme Builder | https://m3.material.io/styles/color/theme-builder |
| Figma Kit M3 pour XR | Material Design Community sur Figma |
| Jetpack Compose for XR | SDK Jetpack XR (SpatialPanel, Orbiter, Subspace) |
| Émulateur Android XR | Android Studio |

---

## 10. ✅ Checklist Design Android XR

- [ ] Couleurs définies via rôles sémantiques M3 (pas de hex codés en dur)
- [ ] Thème sombre avec gris sombres (pas de #000000)
- [ ] Accents colorés limités et désaturés
- [ ] Hit targets >= 48x48dp pour hand/eye tracking
- [ ] Feedback visuel sur tous les états interactifs
- [ ] Typographie Roboto ou Google Sans, échelle M3 respectée
- [ ] Border radius 24dp sur les boutons
- [ ] Panneaux spatiaux testés en passthrough et en monde virtuel
- [ ] Animations testées pour le confort (pas de motion sickness)
- [ ] Contenu centré dans le champ de vision
- [ ] Testé dans l'émulateur Android XR (Android Studio)
