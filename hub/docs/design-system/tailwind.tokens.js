/**
 * GT School Design System — Tailwind theme mapping
 * Source: https://gt.school (Webflow). Values extracted 2026-06-26 from real
 * computed styles + :root variables. See tokens.json / tokens.css for provenance.
 *
 * This repo (hub) is a Next.js + Tailwind project. Merge `gtTheme` into your
 * tailwind.config.* `theme.extend`, e.g.:
 *
 *   // tailwind.config.ts
 *   import { gtTheme } from "./docs/design-system/tailwind.tokens.js";
 *   export default {
 *     theme: { extend: gtTheme },
 *   };
 *
 * Tailwind v4 users can instead translate these into the `@theme { ... }` block
 * in CSS, or just import tokens.css and reference the CSS variables directly.
 *
 * Example utilities this unlocks:
 *   bg-gt-navy text-gt-white   ->  primary button
 *   font-heading text-h1       ->  Literata display headline
 *   bg-gt-off-white            ->  warm section
 *   rounded-gt-md shadow-gt-sm ->  card
 */

const gtTheme = {
  colors: {
    gt: {
      orange: "#e48b53",
      navy: "#002a3a",
      "navy-dark": "#001117",
      blue: "#004f71",
      "blue-dark": "#003b5c",
      "gold-lightest": "#f8e8de",
      "gold-lighter": "#f5ddcd",
      "gold-light": "#ebba9b",
      "yellow-darker": "#5e5515",
      white: "#ffffff",
      "off-white": "#fcf4ef",
      "grey-light": "#d9d9d9",
      grey: "#cac6c4",
      "grey-dark": "#5b5b5b",
    },
    // Semantic aliases
    background: "#ffffff",
    "background-secondary": "#fcf4ef",
    "background-tertiary": "#002a3a",
    foreground: "#001117",
    muted: "#5b5b5b",
    border: "#d9d9d9",
  },

  fontFamily: {
    heading: ["Literata", "Georgia", "sans-serif"],
    body: ["Inter Tight", "Arial", "sans-serif"],
    utility: ["Inconsolata", "Arial", "sans-serif"],
    // Convenience aliases
    sans: ["Inter Tight", "Arial", "sans-serif"],
    serif: ["Literata", "Georgia", "sans-serif"],
    mono: ["Inconsolata", "Arial", "sans-serif"],
  },

  fontWeight: {
    thin: "100",
    xlight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    xbold: "800",
    black: "900",
  },

  // [fontSize, { lineHeight, letterSpacing, fontWeight }]
  fontSize: {
    tiny: ["0.875rem", { lineHeight: "1.25" }],
    small: ["1rem", { lineHeight: "1.3" }],
    regular: ["1.125rem", { lineHeight: "1.3" }],
    medium: ["1.25rem", { lineHeight: "1.25" }],
    large: ["1.5rem", { lineHeight: "1.25" }],
    xlarge: ["2rem", { lineHeight: "1.15" }],
    h6: ["0.875rem", { lineHeight: "1.25", fontWeight: "500" }],
    h5: ["1.25rem", { lineHeight: "1.25", fontWeight: "400" }],
    h4: ["1.5rem", { lineHeight: "1.25", fontWeight: "400" }],
    h3: ["2rem", { lineHeight: "1.15", fontWeight: "300" }],
    h2: ["3rem", { lineHeight: "1.15", fontWeight: "300" }],
    h1: ["3.25rem", { lineHeight: "1.15", letterSpacing: "-0.1rem", fontWeight: "300" }],
  },

  letterSpacing: {
    tight: "-0.1rem",
    normal: "0rem",
  },

  lineHeight: {
    tight: "1.15",
    snug: "1.25",
    relaxed: "1.3",
  },

  // Mirrors the Webflow spacing scale (1rem = 16px)
  spacing: {
    none: "0rem",
    tiny: "0.125rem",
    xxsmall: "0.25rem",
    xsmall: "0.5rem",
    small: "0.75rem",
    regular: "1rem",
    medium: "1.5rem",
    large: "2rem",
    xlarge: "3rem",
    xxlarge: "4rem",
    huge: "5rem",
    xhuge: "6rem",
    xxhuge: "8rem",
    "global-padding": "2.5rem",
    "section-sm": "3rem",
    "section-md": "5rem",
    "section-lg": "8rem",
  },

  maxWidth: {
    "gt-xxsmall": "12rem",
    "gt-xsmall": "16rem",
    "gt-small": "20rem",
    "gt-medium": "32rem",
    "gt-large": "48rem",
    "gt-xlarge": "64rem",
    "gt-xxlarge": "80rem",
    "gt-container-sm": "48rem",
    "gt-container-md": "64rem",
    "gt-container-lg": "90rem",
  },

  borderRadius: {
    "gt-sm": "0.25rem",
    "gt-md": "0.5rem",
    "gt-lg": "0.75rem",
  },

  boxShadow: {
    "gt-sm": "1px 2px 14px 0px rgba(0, 0, 0, 0.03)",
  },

  transitionTimingFunction: {
    gt: "ease",
  },

  transitionDuration: {
    gt: "200ms",
  },
};

module.exports = { gtTheme };
module.exports.default = gtTheme;
