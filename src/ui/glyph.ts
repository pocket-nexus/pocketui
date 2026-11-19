// PocketUI ui/glyph.ts — a mark: a close box's cross, a check, a chevron.
//
// The baked faces hold ASCII and an applet's pack has no room for an icon
// set per theme, so a mark is drawn: a few rectangles, rounded, turned or
// stroked (theme.ts GlyphArt), each one native node. A theme draws the marks
// its tradition has (pixel art for a 1998 desktop, a gel disc for a 2005
// one); a mark it does not draw comes from the stock set below, which is
// strokes in the ink of where it sits.
import { createRenderEffect } from "solid-js";
import { createElement, detachNode, insertNode, setProp, type NodeMirror } from "@pocketjs/framework/renderer";
import { Instance, type BoxProps, type Kind, type Size, type UIRoot } from "./engine.ts";
import { stockGlyph } from "../core/glyphs.ts";
import { REST, type GlyphArt, type GlyphName, type PartState } from "./theme.ts";

export interface GlyphProps extends BoxProps {
  glyph: GlyphName;
  /** the side of the box the mark is drawn for, in points (default 10) */
  size?: number;
  /** a colour, in place of the ink `tone` has where it sits */
  color?: string;
  /** the state of the control it is the mark of, for themes whose marks change with it */
  state?: Partial<PartState>;
}

const CLEAR = "#00000000";

class GlyphInstance extends Instance {
  private marks: NodeMirror[] = [];
  private art: GlyphArt = { w: 0, h: 0, shapes: [] };
  private ink = "#000000";

  constructor(private readonly glyphProps: GlyphProps, parent: Instance | null, root: UIRoot) {
    super(glyphProps, parent, root);
    createRenderEffect(() => {
      const props = this.glyphProps;
      const size = props.size ?? 10;
      const state: PartState = { ...REST, ...props.state };
      const art = root.theme.glyph(props.glyph, size, state) ?? stockGlyph(props.glyph, size);
      const resized = art.w !== this.art.w || art.h !== this.art.h;
      this.art = art;
      this.ink = props.color ?? this.inkFor(props.tone);
      this.draw();
      if (resized) this.invalidate();
    });
  }

  private draw(): void {
    const { shapes } = this.art;
    const marks = this.marks;
    while (marks.length > shapes.length) detachNode(this.node, marks.pop()!);
    while (marks.length < shapes.length) {
      const node = createElement("view");
      insertNode(this.node, node);
      marks.push(node);
    }
    const ox = Math.max(0, (this.w - this.art.w) / 2);
    const oy = Math.max(0, (this.h - this.art.h) / 2);
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i]!;
      const color = shape.color ?? this.ink;
      const style: Record<string, number | string> = {
        posType: 1,
        hitPass: 1,
        insetL: ox + shape.x,
        insetT: oy + shape.y,
        width: shape.w,
        height: shape.h,
        radius: shape.r ?? 0,
        rotate: shape.rot ?? 0,
        opacity: shape.opacity ?? 1,
        bgColor: shape.ring ? CLEAR : color,
        borderWidth: shape.ring ?? 0,
        borderColor: shape.ring ? color : CLEAR,
        gradDir: -1,
      };
      if (shape.gradient && !shape.ring) {
        style.gradFrom = shape.gradient[0];
        style.gradTo = shape.gradient[1];
        style.gradDir = 1;
        style.gradViaPos = NaN;
      }
      setProp(marks[i]!, "style", style);
    }
  }

  protected measureContent(): Size {
    const pad = this.pad;
    return { w: Math.ceil(this.art.w) + pad.l + pad.r, h: Math.ceil(this.art.h) + pad.t + pad.b };
  }

  protected override arrange(): void {
    this.draw();
  }

  override blocksHit(): boolean {
    return this.interactive;
  }
}

export const GLYPH: Kind<GlyphProps> = (props, parent, root) => new GlyphInstance(props, parent, root);
