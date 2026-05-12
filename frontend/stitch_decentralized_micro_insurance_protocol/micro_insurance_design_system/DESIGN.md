---
name: Micro-Insurance Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built on the principles of **Institutional Minimalism**. It bridges the gap between high-velocity Web3 technology and the traditional reliability of insurance. The aesthetic is inspired by the "Utility-First" movement (Stripe, Linear), where clarity, precision, and high-quality typography signal competence and trust.

The brand personality is **composed, authoritative, and frictionless**. It avoids common Web3 tropes like neon accents or heavy gradients in favor of a "Fintech White" aesthetic—clean surfaces, intentional white space, and a refined color palette that prioritizes legibility over decoration. Every element exists to serve the user’s understanding of risk and coverage.

## Colors

The palette is anchored by **Deep Slate (#0F172A)** for primary actions and headings, providing a solid, grounded foundation. The background utilizes a **Soft Off-White (#F8FAFC)** to reduce eye strain and create a premium, paper-like feel.

- **Primary:** Deep Slate is used for high-emphasis UI elements and text.
- **Accents:** A refined **Stellar Blue/Teal (#0D9488)** is used sparingly for interactive cues and secondary emphasis.
- **Success/Trust:** **Deep Emerald (#064E3B)** is reserved for "Covered" statuses, confirmed transactions, and security indicators.
- **Neutrals:** We utilize a cool-toned gray scale for borders (Slate-200) and body text (Slate-600), ensuring a soft but legible contrast ratio.

## Typography

This design system uses a dual-font strategy to balance character with utility. 

**Hanken Grotesk** is used for headlines to provide a sharp, contemporary "Fintech" edge. Its geometry is precise, echoing the reliability of the dApp. **Inter** is the workhorse for all body and UI text, selected for its exceptional legibility in data-heavy environments. 

For Web3-specific data points—such as wallet addresses, transaction hashes, or policy IDs—**JetBrains Mono** is used at a small scale to provide technical clarity without appearing "hacker-esque." 

**Key Rules:**
- Use negative letter spacing for headlines to maintain a tight, professional look.
- Increase line height for body text (1.6) to ensure complex insurance terms are easy to scan.
- Always use `label-caps` for table headers and section overviews.

## Layout & Spacing

The layout follows a **Fixed-Width Centered Grid** for desktop to maintain a controlled, editorial feel, while transitioning to a **Fluid Single-Column** layout for mobile. 

We use an **8pt Grid System** for vertical rhythm. Components are spaced using a "Stack" philosophy—related items (like a label and an input) use `stack-sm`, while distinct sections use `stack-lg`. 

**Breakpoints:**
- **Mobile (<768px):** 4-column grid, 16px margins.
- **Tablet (768px - 1024px):** 8-column grid, 24px margins.
- **Desktop (>1024px):** 12-column grid, 1200px max-width container, 40px margins.

Content should feel "airy." Avoid cramming data; instead, use generous padding within cards to allow the typography to breathe.

## Elevation & Depth

We avoid high-contrast drop shadows. Instead, we use **Tonal Elevation** and **Subtle Ambient Shadows** to create a sense of layering.

- **Level 0 (Background):** #F8FAFC. The canvas.
- **Level 1 (Cards/Surface):** #FFFFFF. White surfaces with a 1px border in #E2E8F0. This is the primary container for content.
- **Level 2 (Interactive):** Elements that are hovered or active use a very soft shadow: `0px 4px 6px -1px rgba(15, 23, 42, 0.05), 0px 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modals/Popovers):** Elements that sit above the UI use a slightly deeper but still diffused shadow to provide focus.

**Borders:** A 1px solid border is the primary tool for defining space, rather than shadows.

## Shapes

The shape language is **Softly Geometric**. We use a base radius of **8px** for standard components (buttons, inputs) and **12px** for larger containers (cards, modals). 

- **Standard (8px):** Buttons, Text Fields, Checkboxes.
- **Large (12px):** Feature Cards, Policy Summaries, Wallet Connect Modals.
- **Full (Pill):** Status badges (e.g., "Active," "Pending").

This subtle rounding balances the "hard" precision of fintech with an approachable "modern" user experience.

## Components

### Buttons
- **Primary:** Background #0F172A, Text #FFFFFF. No shadow. 8px radius.
- **Secondary:** Background #FFFFFF, Border 1px #E2E8F0, Text #0F172A.
- **Ghost:** No background or border. Text #64748B. Use for low-priority actions like "Cancel."

### Inputs
- **Default:** White background, 1px #E2E8F0 border. 8px radius. Text #0F172A.
- **Focus:** Border changes to #0D9488 with a 2px "glow" (0.1 opacity) of the same color. 
- **Labels:** Use `body-sm` with a weight of 500, placed 8px above the field.

### Cards
- **Policy Card:** White background, 1px #E2E8F0 border, 12px radius. Internal padding: 24px. Use a subtle `headline-md` for the title.

### Status Chips
- **Success:** Background #ECFDF5, Text #064E3B. Pill-shaped.
- **Warning:** Background #FFFBEB, Text #92400E. Pill-shaped.
- **Active Coverage:** Use a small 8px pulsing dot next to the text for real-time Web3 status.

### Data Lists
- Use thin 1px horizontal dividers (#F1F5F9). Avoid vertical lines. Align numeric data to the right using the `mono-data` font style for alignment precision.