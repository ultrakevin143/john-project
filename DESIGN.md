---
name: "Water Utility Data Hub"
description: "The network-atlas design system for water-district operations."
colors:
  canvas: "#eef3fa"
  surface: "#fff"
  ink: "#182c48"
  muted: "#536780"
  line: "#d8e2ef"
  wash: "#f5f8fc"
  primary: "#195ac5"
  primary-hover: "#124597"
  focus: "#2d69cf"
  blue-band: "#123c70"
  band-text: "#d1e3fa"
  success: "#176346"
  success-bg: "#e7f5ee"
  warning: "#865000"
  warning-bg: "#fff2d6"
  error: "#a32c42"
  error-bg: "#ffedf0"
  info: "#174e91"
  info-bg: "#e7f0ff"
  overlay: "#10244199"
  white: "#fff"
  canvas-dark: "#101e32"
  surface-dark: "#172a43"
  ink-dark: "#edf3fc"
  muted-dark: "#b0c0d6"
  line-dark: "#344b68"
  wash-dark: "#1d324e"
  primary-dark: "#76aaff"
  primary-hover-dark: "#a2c5ff"
  focus-dark: "#a4c7ff"
  success-dark: "#9de4bc"
  success-bg-dark: "#173e32"
  warning-dark: "#ffd28c"
  warning-bg-dark: "#44371c"
  error-dark: "#ffb3c1"
  error-bg-dark: "#4c2938"
  info-dark: "#a9cfff"
  info-bg-dark: "#233e62"
  network-panel: "#0d3261"
  network-connection: "#507aaa"
  network-selected: "#204d86"
  network-selected-border: "#729dd2"
  band-divider: "#41638a"
  band-label: "#e2eeff"
typography:
  display:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "76px"
    fontWeight: 500
    lineHeight: 1.1
  headline:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  subheading:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.55
  field:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "13px"
    lineHeight: 1.55
  button:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
  supporting:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "12px"
    lineHeight: 1.5
  badge:
    fontFamily: '"Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.4
  balance:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "43px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  score:
    fontFamily: '"Water Barlow", "Segoe UI", sans-serif'
    fontSize: "52px"
    fontWeight: 500
    lineHeight: 1.15
  mono:
    fontFamily: "Consolas, monospace"
    fontSize: "12px"
rounded:
  indicator: "2px"
  badge: "4px"
  compact: "5px"
  event: "6px"
  control: "7px"
  support: "8px"
  panel: "12px"
  prominent: "14px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
  "36": "36px"
  "40": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-outline-hover:
    backgroundColor: "{colors.info-bg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.primary}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    width: "100%"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  card-header:
    padding: "22px 24px"
  badge:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.muted}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
  badge-error:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
  badge-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "0 11px"
  nav-link-current:
    textColor: "{colors.primary}"
  network-node:
    backgroundColor: "{colors.network-panel}"
    textColor: "#eef5ff"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  network-node-selected:
    backgroundColor: "{colors.network-selected}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.prominent}"
    padding: "28px"
    width: "calc(100vw - 32px)"
  signin-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px 28px"
    width: "100%"
---

# Design System: Water Utility Data Hub

## Overview

**Creative North Star: "The Network Atlas"**

The Network Atlas gives water-district work a measured, legible identity: cool reading surfaces, blue actions, an ink-blue operational band and a connection schematic. Water Barlow supplies the headings and large readings; familiar body text keeps forms and records compact.

The system uses flat bordered panels, explicit status words and direct record links. Contrast comes from tone, scale and alignment. The approved John world is separate from the parent Waste Hub: its navigation runs across the top and its sign-in is a centered district panel.

**Key Characteristics:**

- Ink-blue operational surfaces with a reusable DMA schematic.
- Blue actions and current states; named semantic statuses.
- Water Barlow headings and measured numerals over compact system body text.
- Flat bordered panels, aligned tables and explicit refresh controls.

This document records the implemented John system. The overview's composition and task sequence remain in docs/dashboard-surface.md; they are not templates for every future screen. The rendered product identity and browser title are Water Utility Data Hub.

## Colors

Cool paper-like surfaces and dark ink support a decisive blue action color. Semantic green, amber, red and information blue communicate state rather than introduce decorative accents. The frontmatter preserves the CSS values and names; keys ending in -dark record the matching .dark overrides.

### Primary

- **District Blue** (primary): primary actions, active navigation, links, progress and selected control emphasis.
- **Deep Action Blue** (primary-hover): enabled primary-button hover.
- **Focus Blue** (focus): keyboard outline and focused field border.
- **Ink Blue** (blue-band): overview and lineage bands.
- **Band Reading Blue** (band-text): secondary text on ink-blue surfaces.
- **Network Panel Blue** (network-panel): the schematic's darker reading plane.
- **Connection Blue** (network-connection): schematic lines and outlined DMA controls.
- **Selected DMA Blue** (network-selected / network-selected-border): the node's hover and selected fill and stroke.
- **Band Divider / Band Label** (band-divider / band-label): separators and compact labels within the fixed blue surfaces.

### Neutral

- **District Canvas** (canvas): page background around the working content.
- **Work Surface** (surface): header, work panels, form fields, popovers and dialogs.
- **Reading Ink** (ink): primary text.
- **Supporting Ink** (muted): descriptions, metadata, default navigation and supporting labels.
- **Register Line** (line): panel edges, row dividers and inactive progress tracks.
- **Reading Wash** (wash): table headers, subtle hovers and secondary strips.
- **White** (white): text on the fixed operational band and light-theme filled actions.
- **Modal Veil** (overlay): translucent dialog backdrop.

### Semantic states

- **Success Green** (success / success-bg): completed, available and resolved outcomes.
- **Attention Amber** (warning / warning-bg): open work, partial outcomes and investigation states.
- **Breach Red** (error / error-bg): failed, restricted and error states.
- **Information Blue** (info / info-bg): running or acknowledged work and informational context.

The workspace's dark theme substitutes the recorded dark canvas, surface, ink, line, action, focus and semantic pairs. The operational band, network palette, overlay and white token keep their fixed values. Sign-in declares its own fixed light colors. In the dark workspace, primary-button text uses the source's dark blue ink override.

**The Status Words Rule.** Pair semantic color with a visible status or finding. Color is never the only explanation.

## Typography

**Display and heading font:** Water Barlow, with Segoe UI and sans-serif fallbacks.
**Body font:** Segoe UI, Calibri, Arial, sans-serif.
**Code font:** Consolas, monospace.

Water Barlow is self-hosted from public/fonts/Barlow-Medium.ttf and Barlow-SemiBold.ttf at weights 500 and 600, with font-display: swap. The accompanying public/fonts/OFL.txt contains the SIL Open Font License. The system uses a functional hierarchy rather than a single modular scale.

### Hierarchy

- **Display:** large operational readings use the display token. Responsive sizes are recorded below.
- **Headline:** page headings use the headline token; mobile page headings become 28px.
- **Title:** panel headings use the title token; the overview network heading has its own compact 15px treatment.
- **Subheading:** ordinary third-level headings use subheading; attention-row titles use 15px and quality-detail section titles use 16px.
- **Body:** general copy uses body; form controls and tables use 13px. Small supporting text uses supporting, while timestamps and dense metadata have local 10–11px treatments.
- **Label and button:** labels use the label role; buttons use button with its tighter line height. Badges use their compact badge role with sentence-case status words.
- **Balance and score:** summary values use the balance and score roles. Data-trust summary values use a separate 36px, weight-500 Water Barlow treatment.
- **Dialog and sign-in:** dialog titles use 23px, weight 600 and line-height 1.25. The compact sign-in title uses 25px with line-height 1.25 and -0.02em tracking; its district line is 12px.
- **Mono:** payload editing and inline code use mono. Code is not the display face for operational prose.

The urgent display becomes 85px from 1600px, 65px at or below 1100px, then 66px at or below 760px. Those are the current cascade values. The quality score becomes 42px on mobile. Numeric table columns, urgent readings, quality scores and rule facts explicitly request tabular numerals. Band notices are limited to 65ch, empty-state explanations to 54ch and formula blocks to 110ch.

**The Measured Reading Rule.** Keep quantities with their units, labels and period context. Preserve tabular numerals where the implementation uses them for aligned comparisons.

## Layout

The shared shell has a white horizontal masthead, a district/user strip and a centered content container. The content maximum width is 1512px; its desktop inset is 32px 36px 56px. The header is 88px high with 32px side padding. Reused spacing steps are captured in the frontmatter; component-specific offsets remain explicit rather than being forced onto a uniform grid.

The implemented overview has a two-part operational band using a 1.15fr/1fr split, followed by a full-width attention queue. Water balance and data trust sit below it in a 1.2fr/1fr row, followed by the district table and source-freshness register. This is the overview's surface composition, not a requirement to put a network band on every route.

Water-balance detail uses a 1.4fr/1fr network/equation layout. Forms and record-detail definitions commonly use two columns. Tables stay semantically tabular with a 680px minimum width inside a local horizontal scroll container. Numeric columns align right.

### Responsive behavior

- **1600px and wider:** content top padding rises to 40px, the overview band has a 350px minimum height, and its network diagram is 270px high.
- **1250px and narrower:** masthead spacing tightens and main content uses 28px 26px 45px padding.
- **1100px and narrower:** desktop navigation gives way to a labeled menu button and a 300px navigation sheet capped at 88vw. The header becomes 76px high. Integration columns collapse and the quality summary's explanatory section moves below its first two sections.
- **760px and narrower:** the header becomes 70px high and main content uses 24px 16px 36px padding. The operational band, secondary summaries, network/equation layout, forms and record definitions stack. Attention rows wrap their status beneath the record content; tables retain their own horizontal scroll area. The sign-out text is hidden while its button keeps the Sign out accessible name.

Sign-in occupies the viewport as masthead, centered main content and footer. Its panel is capped at 390px with 24px 28px padding. The masthead uses 14px 32px padding, the main area 16px 24px, and the footer 12px 32px. At the mobile breakpoint these become 12px 20px, 12px 18px and 10px 20px respectively; panel padding becomes 22px 24px. The repeated district icon/header block has been removed. The compact layout uses intrinsic sizing, not clipped overflow or a fixed panel height. Fresh rendered overflow verification is outside this documentation pass.

## Elevation & Depth

Work panels are flat: surface fill, a single border and measured internal spacing carry their hierarchy. The ink-blue band creates a stronger reading plane through tone. No card shadow is part of the implemented vocabulary. The translucent modal veil separates temporary dialogs from the workspace.

### Shadow Vocabulary

- **Select popover:** box-shadow: 0 10px 30px #0b254120.
- **Dialog:** box-shadow: 0 18px 70px #091f453d.

**The Flat Panels Rule.** Keep work panels flat. Reserve the existing soft shadows for select popovers and dialogs.

State changes use 0.15s transitions for background color, text color and border color. The loading skeleton pulses opacity between 0.4 and 0.85 over 1.6s with ease-in-out and alternate iteration. Reduced-motion mode disables smooth scrolling and reduces animations and transitions to 0.01ms with one animation iteration. These values are recorded in the sidecar rather than added as unsupported frontmatter groups.

## Shapes

The form language is gently rounded and rectangular. Controls and schematic node labels share the control radius; panels use the panel radius; the overview band and dialogs use prominent corners. Badges have compact squared-off corners, while small progress and volume marks use the indicator radius. Event symbols use the event radius. Single-pixel borders and table rules keep the register crisp.

The node dot is the recurring circular form: a 12px circle with a 3px status-colored stroke, supported by a written node status.

## Components

### Buttons

Compact, labeled actions with clear visual priority. The primitive exposes default, outline, ghost and destructive variants; the default maps to primary. Their shared geometry is a 40px minimum height, control corners and 9px 15px padding. Small buttons use a 33px minimum height, 7px 10px padding and 12px type. Icon buttons are 38px square.

Primary hover uses primary-hover. Outline hover uses info-bg with a focus-colored border; ghost hover uses wash and primary-colored text. The destructive variant uses the error fill with white text. Disabled buttons use 0.5 opacity and a not-allowed cursor. Every keyboard-focused action inherits a 3px focus outline offset by 3px.

### Inputs / Fields

Fields use surface fill, a line border, control corners, 9px 12px padding and a 40px minimum height. Focus changes the border to focus and retains the shared outline. Labels stay above the field with a 7px gap. Textareas begin at a 98px minimum height and resize vertically. Select popovers use support corners, the select shadow, and an info-colored highlighted option.

The compact sign-in overrides field gap to 5px, labels to 12px with line-height 1.5, and input minimum height/padding to 38px and 8px 11px.

### Chips / Statuses

Badges use 3px 8px padding, a 23px minimum height and the badge typography/radius tokens. Neutral badges use wash and muted; semantic variants use their matched foreground/background pair. Status translates machine-style underscores into readable sentence-case labels. Badges describe state; they are not toggle controls.

### Cards / Containers

Work panels use surface, a line border and panel corners. Headers use 22px 24px padding with a lower divider; summary bodies commonly use the same inset. Panels clip their own contents and keep a zero minimum width for responsive grids. Tables have washed headers, single-pixel row separators, generous row padding and wash on hover.

### Navigation

Desktop navigation is horizontal, using 13px semibold text and 0 11px link padding. A current page uses primary text and a 3px lower rule, while hover adds wash. The same route set appears in the responsive sheet; its selected row uses info-bg, primary text and semibold weight. Both versions expose aria-current. The shell includes a keyboard skip link, a named theme control and an explicitly named sign-out control.

### DMA schematic

The reusable diagram is a connection schematic, explicitly identified as non-geographic. SVG lines sit behind positioned node labels. Node text includes the DMA name and breach, leak or NRW context; colored dots supplement those words. In water-balance detail, nodes are buttons with aria-pressed selection; on the overview, they link into the relevant DMA. A selected node uses network-selected and network-selected-border. The refresh action updates both the selected-DMA view and the district network data when a DMA is selected.

### Attention queue and secondary summaries

The attention queue spans the content width. Each linked row carries an event symbol, type/DMA, record title, readable detail, explicit event date and status. The row hover uses wash. Water balance and data trust form the secondary row beneath the queue. They keep period, unit and formula context beside the displayed values.

### Centered sign-in

A compact light panel sits beneath a white product masthead. One heading and a district line lead to two labeled fields, a full-width primary action and a short role/access explanation. The form uses a 14px gap and 20px top margin. The security note uses a 16px top margin and 14px top padding. The footer reads “Independent Cebu prototype” and “Synthetic records · No MCWD affiliation”.

Submission changes the action to Opening workspace… and disables it while busy. Errors appear in the existing alert pattern. The rendered interface and browser metadata use the product name without the implementation label.

### Human-readable quality findings

The wide detail dialog is capped at 920px; standard dialogs are capped at 560px and scroll within 90dvh. Quality detail separates rule identity, severity, checked/failed counts, remediation, named configured thresholds, affected-record samples and investigation notes. The samples table uses Record, Finding and Observed values columns with label/value definitions and record links. No JSON dump is a presentation pattern.

The quality score explains its checked/failed basis and explicitly distinguishes data validity from operational lab breaches. Loading uses named status content, errors offer an explicit retry action, and empty states explain the missing result. The workspace disables interval polling, focus/reconnect revalidation and automatic error retries.

The Cebu Reference setup is an ordinary extension of the Network Atlas, using the existing cards, tables, dialogs and form controls. Correction fields remain labeled; dates and periods use Manila displays. Tariff measurements retain units and precision, with volume shown to three decimal places as needed and unit rates to two through four decimal places. This extension introduces no design tokens.

### Account administration and operational insights

User administration, quality history and meter reliability extend the existing Network Atlas. Account editing uses the shared flat panel, labeled fields, readable access badges and explicit save/cancel actions; its inset remains aligned with the panel heading. Quality history uses the existing action blue for a single measured series, with the formula inside the panel inset and exact run/domain values in tables. Keep the chart and tables locally scrollable on narrow screens rather than compressing their labels. Meter reliability reuses the period controls, report summaries, status words and source-record links, retaining Manila period boundaries, units and coverage explanations. These are ordinary component compositions; they introduce no new tokens or changes to the system identity.

## Do's and Don'ts

### Do:

- Do use the existing semantic colors with visible status words and readable findings.
- Do keep Water Barlow for headings and measured display readings, with the established system stack for forms and tables.
- Do preserve horizontal workspace navigation and its responsive navigation sheet.
- Do retain labels, units, period context, source-record links and visible event dates.
- Do use explicit refresh controls and actionable loading, empty and error states.
- Do keep the schematic identified as schematic, with accessible names and selected-state semantics.

### Don't:

- Don't import the parent's sidebar-led workspace or split-screen sign-in into this approved John world.
- Don't substitute serialized JSON for quality thresholds, findings or observed-value labels.
- Don't use semantic status colors as arbitrary decoration or rely on color alone.
- Don't add decorative shadows to the flat panel vocabulary.
- Don't add polling, focus/reconnect refresh or automatic error-retry loops.

Source authority: frontend/app/globals.css; components/ui/index.tsx; components/login.tsx; components/workspace.tsx; components/views/overview.tsx; components/views/quality.tsx; app/layout.tsx. Product and surface decisions are recorded in PRODUCT.md and docs/dashboard-surface.md. Local review screenshots are verification evidence, not shipping raster assets or token sources.
