// PocketUI themes/aqua.ts — Aqua: the desktop of 2005. A pale grey window
// whose title bar and toolbar shade into one another, three gel lights at
// the leading end of the title, a centred title, capsule buttons with a
// gloss over the top half, a blue gel for the default one, a soft blue halo
// for the focus, and a source list with a blue selection.
//
// Original drawing in PocketJS primitives (gradients under a gloss layer,
// capsules by corner radius); no artwork of any operating system.
import { NO_GLYPH } from "../core/glyphs.ts";
import { defineTheme, FACES, type GlyphArt, type GlyphName, type Layer, type Metrics, type Paint, type Palette, type PartState, type Tone } from "../core/theme.ts";

const WINDOW = "#ececec";
const WHITE = "#ffffff";
const BLUE = "#3875d7";

const c: Palette = {
  canvas: WINDOW,
  surface: WHITE,
  raised: "#f2f2f2",
  selected: BLUE,
  line: "#b8b8b8",
  text: "#000000",
  muted: "#5e5e5e",
  faint: "#8a8a8a",
  accent: "#1558c8",
  accentFill: BLUE,
  onAccent: WHITE,
  good: "#2a8a2a",
  warn: "#b06e00",
  bad: "#c8281c",
  note: "#7a3fb0",
  scrim: "#00000030",
  codeSurface: "#f7f7f7",
  addFill: "#dcf3d8",
  delFill: "#f9dcd9",
  selection: "#b5d5ff",
  caret: "#000000",
};

const ON_BLUE = { text: WHITE, muted: "#dce8f9", faint: "#c3d6f2", accent: WHITE, good: "#d6ffd0", warn: "#fff2b8", bad: "#ffd6d0", note: "#efdcff" };

/** the light across the top half of a gel */
const gloss = (radius: number, inset = 1): Layer => ({ t: inset, l: inset + 2, r: inset + 2, hFrac: 0.46, radius, gradient: ["#ffffffe0", "#ffffff28"] });

const WHITE_GEL: readonly [string, string, string] = ["#fdfdfd", "#e7e7e7", "#f4f4f4"];
const BLUE_GEL: readonly [string, string, string] = ["#b9dcfb", "#4594ea", "#8fc9f8"];
const BLUE_GEL_DOWN: readonly [string, string, string] = ["#9cc9f0", "#2f7dd6", "#74b3ea"];

const captionPaint = (s: PartState): Paint => ({
  gradient: s.active ? ["#ececec", "#d4d4d4"] : ["#f5f5f5", "#e6e6e6"],
  under: [{ t: 0, h: 1, fill: "#fafafa" }],
  pad: [0, 8],
  text: "body",
  ink: { text: s.active ? "#1e1e1e" : "#8a8a8a" },
});

const LIGHTS: Record<string, readonly [string, string, string]> = {
  close: ["#ff8f84", "#e2463c", "#b1362e"],
  minimize: ["#ffdc80", "#e9ab3a", "#b98a2c"],
  zoom: ["#a5e58a", "#4dba3a", "#3b962d"],
};

function button(s: PartState): Paint {
  const radius = 11;
  const ink = { text: s.tone === "bad" ? c.bad : "#000000" };
  if (s.variant === "plain") return { fill: s.pressed ? "#00000018" : undefined, radius: 5, pad: [3, 10], text: "body", ink: { text: s.tone === "bad" ? c.bad : c.accent } };
  const blue = s.variant === "filled" || s.pressed;
  const paint: Paint = {
    gradient: blue ? (s.pressed ? BLUE_GEL_DOWN : BLUE_GEL) : WHITE_GEL,
    border: blue ? "#3d66b3" : "#9a9a9a",
    radius,
    pad: [3, 15],
    text: "body",
    ink,
    under: [gloss(8)],
  };
  if (s.variant === "pill") return { ...paint, shadow: 1, pad: [3, 12] };
  return paint;
}

function badgeFill(tone: Tone | undefined): string {
  switch (tone) {
    case "warn": return "#a86a08";
    case "bad": return "#d0473c";
    case "good": return "#3a8a32";
    case "accent": return BLUE;
    case "note": return "#8e5cc2";
    default: return "#8b9cb5";
  }
}
const ALL_WHITE = { text: WHITE, muted: WHITE, faint: WHITE, accent: WHITE, good: WHITE, warn: WHITE, bad: WHITE, note: WHITE };

function glyphs(name: GlyphName, _size: number, state: PartState): GlyphArt | null {
  // the lights carry no mark, a capsule thumb no ridges
  if (state.variant === "caption" || name === "grip") return NO_GLYPH;
  return null;
}

const METRICS: Metrics = { target: 26, rowPad: 5, gutter: 10, bar: 30, radius: 5, caption: 22, menubar: 22, status: 20, control: 22, scrollbar: 15, captionButton: [12, 12], toggle: [14, 14], knob: [14, 14] };

export const AQUA_THEME = defineTheme({
  id: "aqua",
  label: "Aqua",
  scheme: "light",
  color: c,
  face: { ...FACES, title: FACES.strong },
  metric: METRICS,
  compact: { ...METRICS, target: 22, rowPad: 4, bar: 26 },
  traits: {
    caption: true,
    captionControls: "leading",
    captionTrio: true,
    titleAlign: "center",
    commands: "bar",
    back: "glyph",
    scroll: "strip",
    scrollButtons: false,
    sheets: "window",
    dialogCaption: false,
    defaultLast: true,
    dialogButtons: "trailing",
    rowRules: true,
    sectionCaps: true,
    focusRing: true,
    motion: "slide",
  },
  parts: {
    canvas: { fill: WINDOW },
    pane: { fill: WHITE },
    "pane.detail": { fill: WHITE },
    sidebar: { fill: "#e3e9f1", ink: { muted: "#5c6a7c", faint: "#7c8a9c" } },
    caption: captionPaint,
    "caption.button": (s) => {
      const live = !s.disabled && s.active;
      const stops = live ? (LIGHTS[s.variant ?? "close"] ?? LIGHTS.close!) : (["#f2f2f2", "#cfcfcf", "#a6a6a6"] as const);
      return { gradient: [stops[0], stops[1]], border: stops[2], radius: 6, opacity: s.pressed ? 0.75 : 1, under: [{ t: 1, l: 3, r: 3, h: 4, radius: 2, gradient: ["#ffffffd0", "#ffffff20"] }] };
    },
    menubar: { gradient: ["#f6f6f6", "#e2e2e2"], pad: [0, 6] },
    "menubar.item": (s) => ({ gradient: s.selected || s.pressed ? ["#5f93e8", "#2d66d0"] : undefined, pad: [3, 8], ink: s.selected || s.pressed ? ON_BLUE : undefined }),
    status: { gradient: ["#e9e9e9", "#d6d6d6"], pad: [0, 10], under: [{ t: 0, h: 1, fill: "#a9a9a9" }, { t: 1, h: 1, fill: "#f6f6f6" }], ink: { text: "#3c3c3c" } },
    "status.cell": {},
    // the toolbar carries on from where the title bar's shade ends
    bar: { gradient: ["#d4d4d4", "#b9b9b9"], pad: [3, 8], under: [{ b: 0, h: 1, fill: "#7f7f7f" }], ink: { muted: "#3f3f3f" } },
    "bar.button": (s) => {
      const ink = { accent: "#1c1c1c", bad: c.bad, text: "#1c1c1c" };
      if (s.selected) return { gradient: ["#6a6a6a", "#8c8c8c"], border: "#4f4f4f", radius: 10, pad: [3, 10], ink: { accent: WHITE, bad: WHITE, text: WHITE } };
      return { gradient: s.pressed ? ["#b9b9b9", "#d3d3d3"] : WHITE_GEL, border: "#878787", radius: 10, pad: [3, 10], ink, under: s.pressed ? undefined : [gloss(7)] };
    },
    row: (s) => (s.selected ? { gradient: ["#5d94d6", "#2f6fc4"], pad: [5, 10], ink: ON_BLUE, under: [{ t: 0, h: 1, fill: "#76a4de" }] } : { fill: s.pressed ? "#e6eefb" : undefined, pad: [5, 10] }),
    section: { fill: "#f1f4f8", pad: [6, 10, 3, 10], text: "caption", ink: { text: "#62707f", faint: "#8a96a4" } },
    divider: { fill: "#e0e0e0" },
    button,
    field: (s) => ({ fill: WHITE, border: s.tone === "good" ? c.good : s.selected ? "#5b96dd" : "#9d9d9d", radius: 3, pad: [4, 6], under: [{ t: 1, l: 1, r: 1, h: 1, fill: "#dcdcdc" }] }),
    toggle: (s) => ({ gradient: s.selected ? [BLUE_GEL[0], BLUE_GEL[1]] : [WHITE_GEL[0], WHITE_GEL[1]], border: s.selected ? "#3d66b3" : "#8f8f8f", radius: 3 }),
    "toggle.knob": {},
    segments: {},
    segment: (s) =>
      s.selected
        ? { gradient: ["#5b8fdc", "#3468c4"], border: "#2f5496", radius: 5, pad: [3, 12], ink: ON_BLUE }
        : { gradient: s.pressed ? ["#c9c9c9", "#dedede"] : WHITE_GEL, border: "#9a9a9a", radius: 5, pad: [3, 12] },
    progress: { fill: "#e6e6e6", border: "#8f8f8f", radius: 6, pad: 1 },
    "progress.fill": { gradient: BLUE_GEL, radius: 5 },
    card: (s) => ({ fill: s.pressed ? "#e4e4e4" : "#f1f1f1", border: s.tone === "warn" ? "#dba036" : "#cbcbcb", radius: 6, pad: [6, 9] }),
    well: (s) => ({ fill: "#f7f7f7", border: "#c6c6c6", radius: 3, pad: s.variant === "table" ? 1 : [5, 7] }),
    bubble: (s) =>
      s.variant === "self"
        ? { gradient: ["#d9eaff", "#a9cdfb"], border: "#7daee9", radius: 11, pad: [5, 11], under: [gloss(9)] }
        : { gradient: ["#f7f7f7", "#dedede"], border: "#b4b4b4", radius: 11, pad: [5, 11], under: [gloss(9)] },
    badge: (s) => ({ fill: badgeFill(s.tone), radius: 8, pad: [0, 6], text: "caption", ink: ALL_WHITE }),
    callout: (s) => ({ fill: s.pressed ? "#ececec" : undefined, radius: 4 }),
    tooltip: (s) => ({ fill: "#ffffc8", border: "#c8c890", shadow: 2, pad: [3, 9], ink: { text: s.tone === "bad" ? c.bad : "#000000" } }),
    scrim: { fill: c.scrim },
    menu: { fill: "#fffffff4", border: "#b0b0b0", radius: 5, shadow: 3, pad: [4, 0] },
    "menu.item": (s) => ({ gradient: s.focused || s.pressed || s.selected ? ["#5f93e8", "#2d66d0"] : undefined, pad: [5, 14, 5, 8], ink: s.focused || s.pressed || s.selected ? ON_BLUE : undefined, showsFocus: true }),
    "menu.title": (s) => (s.variant === "menu" ? { pad: [7, 12, 4, 12], text: "caption", ink: { text: "#62707f" } } : { pad: [11, 14, 0, 14] }),
    separator: { fill: "#d4d4d4" },
    dialog: { fill: WINDOW, border: "#9a9a9a", radius: 6, shadow: 3 },
    "dialog.caption": captionPaint,
    "dialog.body": {},
    sheet: { fill: WINDOW, border: "#9a9a9a", shadow: 3 },
    "scroll.track": { gradient: ["#dfdfdf", "#f4f4f4", "#ffffff"], gradientDir: "right", gradientMid: 0.35, under: [{ l: 0, w: 1, fill: "#bdbdbd" }] },
    "scroll.thumb": (s) => ({ gradient: s.pressed ? ["#7fb0ea", "#2f76d2", "#5f9de3"] : ["#a4cbf6", "#4a90e2", "#7fb6f1"], gradientDir: "right", border: "#3f6db6", radius: 7 }),
    "scroll.button": {},
    focus: { border: "#6ea5e8", borderWidth: 3, pad: 2 },
    drag: { gradient: ["#5f93e8", "#2d66d0"], radius: 10, shadow: 2, pad: [3, 10], ink: ON_BLUE },
  },
  glyphs,
});
