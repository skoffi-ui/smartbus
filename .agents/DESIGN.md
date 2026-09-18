---
name: SMARTBUS Design System
colors:
  primary: "#2563EB"
  primary-dark: "#1E40AF"
  accent-cyan: "#06B6D4"
  accent-indigo: "#4F46E5"
  surface-light: "#F8FAFC"
  surface-dark: "#0F172A"
  surface-card: "#FFFFFF"
  state-success: "#10B981"
  state-warning: "#F59E0B"
  state-error: "#EF4444"
  text-heading: "#0F172A"
  text-muted: "#64748B"
---

# Design System: SMARTBUS Transport & Fleet Management
**Project ID:** smartbus-school-transport-v2

## 1. Visual Theme & Atmosphere
The SMARTBUS design system combines **Apple Glassmorphism V3** elegance with high-contrast **tactile 3D controls** and **GIS Live-Tracking indicators**. The visual atmosphere is **ultra-clean, authoritative, and futuristic**. 

It uses a dual-layer strategy:
* **Headers & Command Banners**: Deep midnight dark gradients (`#0F172A` to `#1E1B4B`) illuminated by neon cyan and electric indigo glow effects.
* **Main Working Canvas**: Pristine slate surface (`#F8FAFC`) populated by crisp white glassmorphic cards (`#FFFFFF`), generous rounded corners (`rounded-2xl` and `rounded-3xl`), and subtle 1px border definitions.

## 2. Color Palette & Functional Roles

### Primary Foundation & Surfaces
* **Pristine Slate Surface (`#F8FAFC`)**: Page backdrop providing maximum readability and contrast.
* **Midnight Dark Header (`#0F172A`)**: Command bar background for headers, modals, and supervision banners.
* **Pure White Glass Card (`#FFFFFF`)**: Container background with 1px border (`border-slate-200/90`) and soft elevation shadow.

### Accent & Interactive Gradients
* **Electric Royal Blue (`#2563EB`)**: Primary action buttons, active tab indicators, and main GIS route polyline.
* **Neon Cyan / Sky (`#06B6D4`)**: Live sync badges, animated status pulses, and live tracking markers.
* **Deep Indigo (`#4F46E5`)**: Gradient transitions, secondary active badges, and metric card icons.

### Functional States & GIS Markers
* **Emerald Green (`#10B981` / `#22C55E`)**: Departure stops (`🟢`), validated student boarding scans, high attendance badges, and active bus status.
* **Amber / Gold (`#F59E0B`)**: Intermediate stops (`🟡`), next stop ETA indicators, and warning alerts.
* **Rose / Coral (`#EF4444` / `#F43F5E`)**: Arrival destination (`📍`), absences, capacity overload alerts, and delete actions.

## 3. Typography Rules
* **Font Family**: Inter, system-ui, sans-serif.
* **Headings (H1, H2, H3)**: ExtraBold (`font-black` / `font-extrabold`) with tight letter spacing (`tracking-tight`), deep slate color (`#0F172A`).
* **Sub-labels & Badges**: Uppercase, bold (`font-black`, `text-[10px]` or `text-[11px]`), tracking-widest, muted or vibrant accent colors.
* **Code / Coordinates / Timestamps**: Monospace font (`font-mono`), bold, high contrast.

## 4. Component Stylings

### Buttons & Interactive Controls
* **Primary Buttons**: Vibrant gradient (`from-cyan-500 to-blue-600`), 3D depth, rounded-2xl, flex layout with icon and bold text.
* **Tactile 3D Buttons**: Dual-layer press effect with active Y-axis translation (`translate-y-1` on click).
* **Badges & Pills**: Full rounded (`rounded-full`), 1px border, 11px font size, uppercase tracking.

### Cards & Containers
* **Border Radius**: Generously rounded (`rounded-2xl` and `rounded-3xl`).
* **Borders**: Hairline 1px border (`border-slate-200/90` or `border-white/10` on dark headers).
* **Elevation**: Whisper-soft shadow (`shadow-sm`, `shadow-md`, `shadow-xl`).

### GIS Map & Live Tracking Components
* **Route Polyline**: 6px electric blue line (`#2563EB`) with 0.8 opacity.
* **Bus Marker**: Custom divIcon SVG bus badge with drop-shadow glow and live rotation/position animation.
* **Stop Marker Pins**: Circular badges (`26px x 26px`) with high contrast border (`border: 2px solid white`) and color coding (`🟢 Departure`, `🟡 Stop`, `📍 Arrival`).

## 5. Layout Principles
* **Grid Structure**: 12-column responsive layout (`lg:grid-cols-12`).
  * *Left Sidebar / Inspector*: 4 columns (`lg:col-span-4`) for list items, course selection, and timeline.
  * *Main Canvas*: 8 columns (`lg:col-span-8`) for interactive map, student assignment grid, or audit table.
* **Whitespace Strategy**: Generous gap spacing (`gap-5`, `gap-6`), padded cards (`p-5`, `p-6`).
* **Custom Scrollbars**: Minimalist 5px scrollbar with subtle thumb styling.

## 6. Design System Notes for Stitch Generation
* **Atmosphere Language**: "Sleek Apple Glassmorphic dashboard with electric blue accents, midnight headers, neon cyan status badges, and tactile rounded cards."
* **Color Prompt Reference**: Use `#2563EB` for primary actions, `#F8FAFC` for background, `#0F172A` for dark banners, `#10B981` for success, and `#EF4444` for alerts.
