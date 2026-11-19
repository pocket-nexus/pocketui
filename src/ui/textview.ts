// PocketUI ui/textview.ts — the Text element: a paragraph that wraps to the
// width it is offered and reports the height that takes.
//
// One native text node per paragraph: the lines are joined with "\n", which
// is the only break the core makes (engine/core/src/text.rs), so a wrapped
// paragraph costs one node whatever its length.
import { createRenderEffect } from "solid-js";
import { getOps } from "@pocketjs/framework/host";
import { createTextNode, insertNode, replaceText, setProp, type NodeMirror } from "@pocketjs/framework/renderer";
import { cachedMeasure, ellipsize, wrapText, type Line, type Measure } from "../core/text.ts";
import { Instance, type BoxProps, type Kind, type Size, type UINode, type UIRoot } from "./engine.ts";
import { FACES, type Face, type TextRole, type Tone } from "./theme.ts";

export interface TextProps extends BoxProps {
  /** the text; children do the same */
  value?: string | number;
  children?: UINode;
  /** the face by its role (default: the part's it is in, else "body"), or a face */
  role?: TextRole | Face;
  /** what it means: the theme and the part it is in give the colour (default "plain") */
  tone?: Tone;
  /** a colour, in place of the tone's */
  color?: string;
  /** at most this many lines, the last cut with an ellipsis */
  lines?: number;
  align?: "left" | "center" | "right";
}

const measures = new Map<number, Measure>();
/** Width of one line of text in a font slot, remembered per word. */
export function measureIn(slot: number): Measure {
  let measure = measures.get(slot);
  if (!measure) {
    measure = cachedMeasure((text) => getOps().measureText(text, slot));
    measures.set(slot, measure);
  }
  return measure;
}

/** Drop what was measured in a slot: its atlas changed. */
export function forgetMeasures(slot: number): void {
  measures.delete(slot);
}

/** What a face resolves a text to: the slot that can draw it now, and whether to lay it out again when glyphs arrive. */
export interface FaceResolver {
  resolve(text: string, face: Face): { face: Face; text: string; pending: boolean };
  /** a signal read: bumps when a run-time atlas loads */
  revision(): number;
}

let resolver: FaceResolver | null = null;
export function setFaceResolver(next: FaceResolver | null): void {
  resolver = next;
}

/** Curly quotes, dashes and ellipses as the ASCII the baked faces hold, so
 *  English prose stays in them. */
function plainPunctuation(value: string): string {
  return value.replace(/[\u2018\u2019\u201a\u2032]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"').replace(/[\u2013\u2014\u2015\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u00a0/g, " ").replace(/\t/g, "  ");
}

/** A signal read that changes when run-time glyphs arrive: what was resolved before may resolve to a better face now. */
export function faceRevision(): number {
  return resolver ? resolver.revision() : 0;
}

const ASCII_ONLY = /^[\x00-\x7f]*$/;

/** The face that can draw `text` now, and the text as that face draws it.
 *  Text the baked faces cannot draw goes to the installed resolver (run-time
 *  glyphs); without one, each such character shows as "?". */
export function resolveFace(text: string, face: Face): { face: Face; text: string; pending: boolean } {
  let plain = text;
  if (!ASCII_ONLY.test(plain)) plain = plainPunctuation(plain);
  if (ASCII_ONLY.test(plain)) return { face, text: plain, pending: false };
  if (resolver) {
    resolver.revision();
    return resolver.resolve(plain, face);
  }
  return { face, text: plain.replace(/[^\x00-\x7f]/g, "?"), pending: false };
}

function textOf(value: unknown): string {
  if (value == null || value === false || value === true) return "";
  if (typeof value === "function") return textOf((value as () => unknown)());
  if (Array.isArray(value)) {
    let out = "";
    for (const item of value) out += textOf(item);
    return out;
  }
  return String(value);
}

const ALIGN = { left: 0, center: 1, right: 2 } as const;

class TextInstance extends Instance {
  private run: NodeMirror;
  private text = "";
  private drawn: string | undefined;
  private face: Face = FACES.body;
  private maxLines = Infinity;
  private laid: { width: number; lines: Line[] } | null | undefined;
  private painted = "";

  constructor(private readonly textProps: TextProps, parent: Instance | null, root: UIRoot) {
    super(textProps, parent, root, "text");
    this.run = createTextNode("");
    insertNode(this.node, this.run);
    createRenderEffect(() => {
      const props = this.textProps;
      const source = props.value !== undefined ? String(props.value) : textOf(props.children);
      const role = props.role ?? this.roleFor();
      const resolved = resolveFace(source, typeof role === "string" ? this.root.theme.face[role] : role);
      const face = resolved.face;
      const drawn = resolved.text;
      const maxLines = props.lines ?? Infinity;
      this.text = source;
      // a row whose item was republished unchanged measures nothing again
      if (drawn === this.drawn && face === this.face && maxLines === this.maxLines && this.laid !== undefined) return;
      this.drawn = drawn;
      this.face = face;
      this.maxLines = maxLines;
      this.laid = null;
      setProp(this.node, "style", { fontSlot: face.slot, lineHeight: face.line });
      this.invalidate();
    });
    createRenderEffect(() => {
      const props = this.textProps;
      setProp(this.node, "style", { textColor: props.color ?? this.inkFor(props.tone), textAlign: ALIGN[props.align ?? "left"] });
    });
  }

  private layout(width: number): Line[] {
    const laid = this.laid;
    if (laid && laid.width === width) return laid.lines;
    const measure = measureIn(this.face.slot);
    const drawn = this.drawn ?? "";
    const lines =
      this.maxLines === 1 && width !== Infinity
        ? [{ text: ellipsize(drawn, width, measure), width: 0, start: 0, end: drawn.length }]
        : wrapText(drawn, width, measure, { maxLines: this.maxLines, ellipsis: "..." });
    if (this.maxLines === 1 && lines[0]) lines[0].width = measure(lines[0].text);
    this.laid = { width, lines };
    return lines;
  }

  protected measureContent(maxW: number, _maxH: number): Size {
    const pad = this.pad;
    const inner = maxW === Infinity ? Infinity : Math.max(0, maxW - pad.l - pad.r);
    const lines = this.layout(inner);
    let width = 0;
    for (const line of lines) if (line.width > width) width = line.width;
    return { w: Math.ceil(width) + pad.l + pad.r, h: lines.length * this.face.line + pad.t + pad.b };
  }

  protected override arrange(w: number, _h: number): void {
    const pad = this.pad;
    const lines = this.layout(Math.max(0, w - pad.l - pad.r));
    let joined = "";
    for (let i = 0; i < lines.length; i++) joined += i === 0 ? lines[i]!.text : `\n${lines[i]!.text}`;
    if (joined !== this.painted) {
      replaceText(this.run, joined);
      this.painted = joined;
    }
    if (pad !== undefined) setProp(this.node, "style", { paddingT: pad.t, paddingL: pad.l, paddingR: pad.r, paddingB: pad.b });
  }

  /** The text as given, for tests and the agent. */
  source(): string {
    return this.text;
  }

  override blocksHit(): boolean {
    return this.interactive;
  }
}

export const TEXT: Kind<TextProps> = (props, parent, root) => new TextInstance(props, parent, root);
