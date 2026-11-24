---
name: Serene Pebble
colors:
  surface: '#fcf8ff'
  surface-dim: '#dad6ff'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f2ff'
  surface-container: '#efebff'
  surface-container-high: '#e9e5ff'
  surface-container-highest: '#e3dfff'
  on-surface: '#181445'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d2a5b'
  inverse-on-surface: '#f3eeff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#5f5a7c'
  on-secondary: '#ffffff'
  secondary-container: '#dcd5fd'
  on-secondary-container: '#605b7d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a1800'
  on-tertiary-container: '#9e7e57'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e5deff'
  secondary-fixed-dim: '#c8c2e9'
  on-secondary-fixed: '#1b1735'
  on-secondary-fixed-variant: '#474363'
  tertiary-fixed: '#ffddb7'
  tertiary-fixed-dim: '#e6c095'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#5b4220'
  background: '#fcf8ff'
  on-background: '#181445'
  surface-variant: '#e3dfff'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  margin-desktop: 2.5rem
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 2.5rem
---

## Brand & Style

This design system is tailored for an AI wellness companion supporting individuals navigating chronic conditions. The brand persona is calm, empathetic, deeply supportive, and reliable. Living with chronic conditions often brings cognitive and sensory fatigue; hence, the emotional response must avoid clinical austerity, harsh alarms, or hyper-athletic urgency. Instead, the UI evokes warmth, emotional balance, optimism, and gentle reassurance.

The visual direction draws from **Soft Modern Tactile Minimalism**:
- **Pebble & Soft-Geometry Aesthetic:** Generously rounded containers, soft pill-like buttons, and gentle tactile surfaces inspired by smooth river stones and organic 3D shapes.
- **Cognitive Clarity:** High-contrast text set over calming pastel tinted cards creates effortless scanning without straining visual or mental bandwidth.
- **Gentle Hierarchy:** Expressive layout grouping, modular cards, and generous tap targets ensure stress-free accessibility for motor or energy limitations.

## Colors

The palette combines soothing ambient periwinkle/lavender backgrounds with multi-hued pastel functional containers and ultra-crisp slate ink text for maximum clarity.

### Primary Role
- **Primary Ink / Anchor (`#0F172A`):** Deep Obsidian Slate. Used for primary text, active selection pills, bottom floating navigation hubs, and key actionable anchors. Delivers AAA contrast against white and soft pastel backdrops.

### Accent & Pastel Tiers
- **Periwinkle Canvas (`#F4F3FF` / `#ECEBFF`):** Global canvas background providing warmth and restfulness.
- **Pastel Lavender (`#DDD6FE` / `#EDE9FE`):** Mindfulness, recovery, and daily focus cards.
- **Warm Apricot (`#FED7AA` / `#FFEDD5`):** Energy, hydration, nutrition, and scheduled daytime sessions.
- **Sky Blue (`#BAE6FD` / `#E0F2FE`):** Balance, breathing, biometric stability, and calm tracking.
- **Mint Sage (`#BBF7D0` / `#DCFCE7`):** Health markers, baseline stability, completed milestones, and symptom remission.
- **Soft Blush (`#FBCFE8` / `#FDF2F8`):** Restorative care, emotional check-ins, and social community links.

### Text & Contrast
- **Headline Ink:** `#1E1B4B` (Deep Indigo) & `#0F172A` (Obsidian Slate).
- **Muted Body Ink:** `#64748B` (Cool Slate).
- **Card Neutral Surface:** `#FFFFFF` (Pure Base White) for baseline cards and list rows.

## Typography

The typography system relies on **Plus Jakarta Sans** throughout headlines, body copy, and micro-labels. Its modern geometric curves with subtle humanist warmth provide an approachable, comforting cadence while maintaining impeccable legibility.

- **Weight Discipline:** Headlines utilize 600 (SemiBold) and 700 (Bold) to guarantee immediate scanning for users dealing with brain fog or fatigue.
- **Line Heights:** Set generously (1.4–1.5x) to alleviate visual clutter and ensure effortless tracking across screen sizes.
- **Numbers & Metrics:** Vital signs, metric values, and weights use semi-bold tabular numerals to prevent layout shifts.

## Layout & Spacing

The layout embraces a tactile, modular grid structured around comfortable human hand movement and generous breathing room.

- **Mobile Viewport:** A 4-column fluid layout with `1.25rem` (20px) outer canvas margins and `1rem` (16px) gutters. Content lives in distinct pill/curved card groups.
- **Tablet / Desktop Expansion:** Expands to an 8 or 12-column structure centered with a max-width container of 1080px to preserve intimate readability without broad eye travel.
- **Touch-First Guardrails:** All interactive targets strictly uphold a minimum touch footprint of 48×48px. 
- **Bottom Clearance:** Screens include an explicit padding-bottom of at least `5.5rem` (88px) to float comfortably above the fixed pebble navigation bar.

## Elevation & Depth

Visual depth is achieved through **tonal color shifts and ambient soft occlusion** rather than stark, heavy drop shadows:

- **Soft Base Ambient Shadow:** Applied to white cards floating on periwinkle: `0px 8px 24px -4px rgba(30, 27, 75, 0.04)`.
- **Card Tiers:** Tinted pastel cards (`#DDD6FE`, `#FED7AA`, `#BAE6FD`, `#BBF7D0`) use flat surface tinting without dark borders, sitting directly on the canvas to look soft and friendly.
- **Pill Navigation & Floating Widgets:** The dark navigation bar uses an intentional dark presence anchored with `0px 12px 32px -6px rgba(15, 23, 42, 0.18)` to establish a grounded handheld tool feel.
- **Tactile Accents:** 3D soft clay elements, rings, and smooth pebble illustrations integrate naturally via subtle internal gradients and diffuse surface highlights.

## Shapes

The design system embraces an ultra-rounded pebble shape philosophy:

- **Primary Cards & Modules:** 24px to 32px border radii (`rounded-2xl` to `rounded-3xl`), creating a soothing, organic container shape.
- **Buttons, Tags & Chips:** Full circular radii (`rounded-full` / 9999px) producing pebble pills.
- **Icon Pods & Avatars:** Fully rounded circles (`rounded-full`) or soft squircular pebble contours.
- **Floating Navigation Bar:** Symmetrically curved dark capsule with embedded circular or pill status indicators.

## Components

### Buttons & Interactive Pills
- **Primary Action Pill:** Solid `#0F172A` background, pure white text (`#FFFFFF`), full pill shape (`rounded-full`), height 48px to 52px, horizontal padding `space-xl`.
- **Ghost / Tonal Button:** Soft pastel tint or transparent with 1.5px subtle border (`#E2E8F0`), deep ink label.
- **Day Selector Capsule:** Vertical or horizontal pill containing the day abbreviation and date number. Default state: clean white pill or translucent surface; Active state: solid `#0F172A` fill with high-contrast white text and an internal micro-dot indicator.

### Cards & Module Containers
- **Hero & Challenge Cards:** 28px-32px rounded corners, filled with pastel tints (e.g., `#DDD6FE` or `#FED7AA`). Pairs bold headlines with rich 3D tactile shapes (pebbles, rings, and soft clay geometries) anchored on the right quadrant.
- **Stat Metric Cards:** 24px rounded corners, compact 3-column row format (`Start weight`, `Goal`, `Daily calories`), tinted in harmonious pastels (sage, sky blue, apricot). Metrics displayed in prominent bold typography (`display-sm` or `headline-md`).

### List Items & Symptom Tracking Rows
- **Structure:** Clean horizontal rows over clean white (`#FFFFFF`) or subtle card surfaces.
- **Icon Prefix:** Uncontained or wrapped inside a 40px soft-tinted circular badge.
- **Content:** Primary bold title (`body-lg`, 600 weight) with secondary muted sub-label (`body-sm`, `#64748B`).
- **Trailing Indicator:** Right chevron (`#94A3B8`) or interactive toggle switch with ample tap padding.

### Floating Bottom Navigation Bar
- **Form:** Autonomous dark obsidian pill (`#0F172A`) floating 16px to 24px above the bottom screen boundary, centered with horizontal margins.
- **Tabs:** 4 primary destinations (Home, Plan, Progress, Profile) represented by line icons.
- **Active State Indicator:** A high-contrast circular or capsule pill in pure white (`#FFFFFF`) with inverted dark slate icon (`#0F172A`), delivering instant location feedback.

### Form Inputs & Checkboxes
- **Input Fields:** 52px height, 20px rounded corners, crisp white background with a soft border (`#E2E8F0`), transitioning to a soft lavender focus ring (`#DDD6FE`, 3px spread).
- **Selection Controls:** Rounded pill checkboxes and soft radio toggles with unambiguous active states and accessible color contrast.