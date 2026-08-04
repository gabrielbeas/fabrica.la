---
name: Slate & Sage Private Equity
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434749'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#747879'
  outline-variant: '#c3c7c8'
  surface-tint: '#586062'
  primary: '#181f21'
  on-primary: '#ffffff'
  primary-container: '#2d3436'
  on-primary-container: '#959c9f'
  inverse-primary: '#c1c8ca'
  secondary: '#556435'
  on-secondary: '#ffffff'
  secondary-container: '#d6e7ac'
  on-secondary-container: '#5a6839'
  tertiary: '#695f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b9ad49'
  on-tertiary-container: '#474000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde4e6'
  primary-fixed-dim: '#c1c8ca'
  on-primary-fixed: '#161d1f'
  on-primary-fixed-variant: '#41484a'
  secondary-fixed: '#d9e9ae'
  secondary-fixed-dim: '#bdcd94'
  on-secondary-fixed: '#151f00'
  on-secondary-fixed-variant: '#3e4c20'
  tertiary-fixed: '#f3e57b'
  tertiary-fixed-dim: '#d6c862'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#4f4700'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  success-emerald: '#10B981'
  warning-amber: '#F59E0B'
  surface-cool: '#F1F3F6'
  border-subtle: '#E2E8F0'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.01em
  kpi-value:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.01em
  section-header:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  body-main:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.06em
  label-small:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.2'
  badge-text:
    fontFamily: Hanken Grotesk
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  page-margin: 40px
  section-gap: 32px
  grid-gutter: 16px
  component-padding: 12px
  stack-tight: 4px
  stack-base: 8px
---

## Brand & Style

The design system embodies a **Modern Corporate** aesthetic tailored for high-end real estate and private equity management. It moves away from traditional luxury tropes (gold/navy) toward a "New Minimalist" philosophy that prioritizes intellectual rigor and architectural precision.

The emotional response should be one of **calm authority and stability**. By utilizing a palette of deep charcoals and organic greens against crisp, airy surfaces, the UI mimics the atmosphere of a modern gallery or a high-end architectural firm. The style avoids heavy ornamentation, relying instead on masterful typography, generous whitespace, and subtle tonal layering to establish a premium hierarchy.

## Colors

This design system utilizes a sophisticated, desaturated palette to communicate professional growth and structural integrity.

- **Primary (#2D3436):** A deep Slate/Charcoal used for high-level headers, primary navigation, and critical values. It provides the grounding force of the interface.
- **Secondary (#4F5D2F):** A muted Sage Green representing stability and architectural growth. Used for key interactive elements and brand accents.
- **Surface Strategy:** The system uses "Crisp White" (#FFFFFF) for primary cards and "Cool Gray" (#F1F3F6) for background containers to create a soft but clear depth hierarchy without relying on heavy shadows.
- **Semantic Logic:** Success states use a clean Emerald for "Sold" properties, while Warning states utilize a soft Amber for "Reserved" units, ensuring clarity in high-density data views.

## Typography

The typography system relies exclusively on **Hanken Grotesk**, refined to emphasize the contrast between data values and structural labels.

- **Contrast Ratios:** Heavy weights (700) are reserved for tiny labels and section headers to ensure they remain legible even at small scales. 
- **Financial Data:** All numeric values should use `font-variant-numeric: tabular-nums` to maintain vertical alignment in tables and KPI grids.
- **Visual Hierarchy:** Large headers use a slight negative letter-spacing for a more polished, editorial feel, while small labels use expanded tracking (uppercase) to improve scannability in dense layouts.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. While the sidebar and primary navigation remain anchored, the main content area utilizes a fluid grid that maximizes the "bird’s-eye view" of property inventories.

- **Grid System:** A 12-column grid for desktop, reflowing to a single column for mobile. For property grids, use `repeat(auto-fill, minmax(200px, 1fr))` to ensure unit cards maintain a substantial presence.
- **Rhythm:** An 8px base unit governs all spatial relationships. Card internal padding is set at 18px to provide a premium sense of "breathability" around dense data points.
- **Breakpoints:**
  - **Mobile:** < 768px (Transitions to 16px margins, stack-based layout).
  - **Tablet:** 768px - 1024px (Gutter reduction to 12px).
  - **Desktop:** > 1024px (Full 40px page margins).

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and ultra-refined shadows. The interface avoids the "floating" look of heavy material design, opting for a grounded, structural feel.

- **Layer 0 (Background):** Crisp White (#FFFFFF).
- **Layer 1 (Containers):** Cool Gray (#F1F3F6) used for grouping related content (e.g., table headers, sidebar).
- **Layer 2 (Cards):** White surfaces with a 1px border in `border-subtle` (#E2E8F0) and a very soft ambient shadow: `0 2px 4px rgba(45, 52, 70, 0.04)`.
- **Interaction:** On hover, cards should lift slightly using a 2px translation and an increased shadow spread (`0 8px 16px rgba(45, 52, 70, 0.08)`) to signal interactivity.

## Shapes

The shape language is **Soft (0.25rem - 0.75rem)**. This provides a subtle modern friendliness without sacrificing the professional rigor of a financial tool. 

- **Standard Elements:** Buttons and Input fields use 4px (0.25rem) radii.
- **Large Elements:** KPI Cards and Modals use 12px (0.75rem) radii to differentiate them from smaller data components.
- **Status Pills:** Status indicators (Sold, Reserved, Available) should use a fully rounded/pill-shaped radius to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use the Slate (#2D3436) background with white text. Secondary buttons use a ghost style with a Sage (#4F5D2F) border and text.
- **Unit Cards:** These are the core of the dashboard. Use a 1px border-subtle. The top 4px should have a colored "status stripe" (Emerald, Amber, or Gray) to indicate property status at a glance.
- **KPI Cards:** Use Hanken Grotesk 600 for the value. Labels should be placed above the value in `label-caps` style with 0.06em tracking.
- **Inputs:** High-precision styling. Use 1px borders. Focus states should transition the border color to Sage (#4F5D2F) with a 2px outer glow in a 10% opacity version of the same color.
- **Tables:** Remove vertical dividers. Use horizontal `border-subtle` only. Row hover states should use `surface-cool` (#F1F3F6) to maintain focus.
- **Timeline/Progress:** Vertical tracks use 2px Sage lines with solid 8px dots for completed milestones and hollow 8px dots for pending ones.