#!/usr/bin/env bun
// bun tools/sim.ts <pocket.app.json> [--size WxH | --psp] [--do "<steps>"] [--shot out.png]
//
// Build a PocketUI application for PocketJS's simulator (the 3ds-dev
// toolchain with --pocket-only) and run it headless on one surface: `--size`
// is a touch surface of that many points (default 640x360), `--psp` a
// 480x272 screen with buttons and no touch. Without a manifest it runs the
// gallery (gallery/pocket.app.json).
//
// Steps, separated by ";":
//   frames:N            run N frames
//   tap:X,Y             a tap           hold:X,Y,N   a contact held N frames
//   drag:X0,Y0,X1,Y1[,N]  a drag over N frames (default 12)
//   lift:X0,Y0,X1,Y1[,H,N] a contact held H frames (a long press), then dragged over N and let go;
//                       liftshot:FILE before it takes a PNG while the contact is still down
//   press:NAME          a button: UP DOWN LEFT RIGHT CIRCLE CROSS TRIANGLE SQUARE LTRIGGER RTRIGGER START SELECT
//   type:TEXT           the keyboard commits TEXT        key:NAME   an editing key
//   shot:FILE           a PNG of the surface             texts      print the painted texts
//   cmd:ID              run one of the application's commands by its id (through globalThis.__pocketUI)
//   theme:ID            ask the application for another theme (globalThis.__pocketUISetTheme, where it sets one)
//
// The functions are exported for an application's own simulator tool and
// tests: it passes its repository as `root` and adds the services it needs.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { existsSync } from "node:fs";

/** This repository. */
export const POCKETUI = resolve(import.meta.dir, "..");

/** PocketJS: this repository's own checkout, or the one beside it where both are vendored into an application. */
export function pocketjsRoot(): string {
  for (const candidate of [process.env.POCKETJS_ROOT, join(POCKETUI, "vendor/pocketjs"), resolve(POCKETUI, "../pocketjs")]) {
    if (candidate && existsSync(join(candidate, "tools/3ds.ts"))) return resolve(candidate);
  }
  throw new Error("pocketui: no PocketJS checkout: run `git submodule update --init vendor/pocketjs`, or set POCKETJS_ROOT");
}

export interface BuildOptions {
  /** the repository the application's imports stay inside (default: this one) */
  root?: string;
  /** the PocketJS checkout (default: pocketjsRoot()) */
  pocketjs?: string;
  /** where the guest and its plan go (default: <root>/.cache/sim) */
  out?: string;
}

let VENDOR = "";

export async function buildGuest(manifestPath: string, options: BuildOptions = {}): Promise<string> {
  const ROOT = resolve(options.root ?? POCKETUI);
  VENDOR = resolve(options.pocketjs ?? pocketjsRoot());
  const OUT = resolve(options.out ?? join(ROOT, ".cache/sim"));
  const { readPocketManifest } = await import(resolve(VENDOR, "framework/src/manifest/load.ts"));
  const { resolve3dsBuildPlan } = await import(resolve(VENDOR, "tools/3ds-profile.ts"));
  const plan = resolve3dsBuildPlan(readPocketManifest(resolve(manifestPath)).manifest);
  mkdirSync(join(OUT, "plans"), { recursive: true });
  const planPath = join(OUT, "plans", `${plan.app.output}.3ds.plan.json`);
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  const build = Bun.spawnSync([process.execPath, "tools/3ds.ts", `--plan=${planPath}`, `--project-root=${ROOT}`, "--pocket-only", `--outdir=${join(OUT, "guest")}`, `--package-outdir=${OUT}`], { cwd: VENDOR, env: { ...process.env, POCKETJS_MINIFY: process.env.POCKETJS_MINIFY ?? "1" }, stdout: "pipe", stderr: "pipe" });
  if (build.exitCode !== 0) throw new Error(`build failed\n${build.stdout}${build.stderr}`);
  return join(OUT, "guest", plan.app.output);
}

export interface SimOptions {
  /** a touch surface of this size; null: the PSP's screen, buttons only */
  size: [number, number] | null;
  /** installed on globalThis before the bundle evaluates (a worker bridge) */
  globals?: Record<string, unknown>;
  /** requests still being answered in real time: frames wait for them */
  busy?: () => number;
}

export interface Sim {
  surface: "primary" | "auxiliary";
  console: any;
  run(frames: number): Promise<void>;
  tap(x: number, y: number): Promise<void>;
  hold(x: number, y: number, frames: number): Promise<void>;
  drag(x0: number, y0: number, x1: number, y1: number, frames?: number): Promise<void>;
  /** a contact held still (a long press), then moved and let go: a drag of a lifted thing */
  lift(x0: number, y0: number, x1: number, y1: number, hold?: number, frames?: number): Promise<void>;
  /** called while a `lift` is still down at its end point */
  mid?: () => void;
  press(name: string, settle?: number): Promise<void>;
  type(text: string): Promise<void>;
  key(name: string): Promise<void>;
  texts(): string[];
  shot(file: string): void;
  logs(): string[];
}

export async function bootSim(guest: string, options: SimOptions): Promise<Sim> {
  if (!VENDOR) VENDOR = pocketjsRoot();
  const { bootConsole3ds } = await import(resolve(VENDOR, "programs/sim/console-3ds.ts"));
  const { encodePNG } = await import(resolve(VENDOR, "tools/png.ts"));
  const { BTN } = await import(resolve(VENDOR, "contracts/spec/spec.ts"));
  for (const [key, value] of Object.entries(options.globals ?? {})) (globalThis as Record<string, unknown>)[key] = value;
  const psp = options.size === null;
  const app = await bootConsole3ds({ js: `${guest}.js`, pak: `${guest}.pak`, current: guest.split("/").pop(), link: null, wifi: null, camera: false, ...(psp ? { auxiliary: null, primary: [480, 272] } : { auxiliary: options.size }) });
  const surface = psp ? "primary" : "auxiliary";
  let seen = 0;
  const sim: Sim = {
    surface,
    console: app,
    async run(frames) {
      for (let i = 0; i < frames; i++) {
        await app.step();
        // a service that works in real time (a glyph atlas being drawn) gets it
        for (let waited = 0; options.busy && options.busy() > 0 && waited < 400; waited++) await new Promise((done) => setTimeout(done, 5));
      }
    },
    tap: (x, y) => app.tap(x, y),
    async hold(x, y, frames) {
      for (let i = 0; i < frames; i++) await app.step({ touches: [{ id: 1, x, y }], surface });
      await app.run(4);
    },
    drag: (x0, y0, x1, y1, frames = 12) => app.drag(x0, y0, x1, y1, frames),
    async lift(x0, y0, x1, y1, hold = 40, frames = 16) {
      for (let i = 0; i < hold; i++) await app.step({ touches: [{ id: 1, x: x0, y: y0 }], surface });
      for (let i = 1; i <= frames; i++) await app.step({ touches: [{ id: 1, x: x0 + ((x1 - x0) * i) / frames, y: y0 + ((y1 - y0) * i) / frames }], surface });
      sim.mid?.();
      await app.step({ touches: [{ id: 1, x: x1, y: y1 }], surface });
      await app.run(6);
    },
    press: (name, settle = 6) => app.press(BTN[name as keyof typeof BTN], settle),
    type: (text) => app.type(text),
    key: (name) => app.key(name),
    texts: () => app.texts(surface),
    shot(file) {
      const p = app.world.pixels(surface);
      mkdirSync(dirname(resolve(file)), { recursive: true });
      writeFileSync(resolve(file), encodePNG(p.rgba, p.width, p.height));
    },
    logs() {
      const out = app.world.logs.slice(seen).map((log: { frame: number; text: string }) => `[${log.frame}] ${log.text}`);
      seen = app.world.logs.length;
      return out;
    },
  };
  return sim;
}

export async function runSteps(sim: Sim, steps: string): Promise<void> {
  for (const step of steps.split(";").map((s) => s.trim()).filter(Boolean)) {
    const colon = step.indexOf(":");
    const op = colon < 0 ? step : step.slice(0, colon);
    const arg = colon < 0 ? "" : step.slice(colon + 1);
    const nums = arg.split(",").map(Number);
    switch (op) {
      case "frames": await sim.run(nums[0]!); break;
      case "tap": await sim.tap(nums[0]!, nums[1]!); break;
      case "hold": await sim.hold(nums[0]!, nums[1]!, nums[2] ?? 40); break;
      case "drag": await sim.drag(nums[0]!, nums[1]!, nums[2]!, nums[3]!, nums[4] ?? 12); break;
      case "lift": await sim.lift(nums[0]!, nums[1]!, nums[2]!, nums[3]!, nums[4] ?? 40, nums[5] ?? 16); break;
      case "liftshot": sim.mid = () => sim.shot(arg); break;
      case "press": await sim.press(arg); break;
      case "type": await sim.type(arg); break;
      case "key": await sim.key(arg); break;
      case "shot": sim.shot(arg); console.log(`shot ${arg}`); break;
      case "texts": console.log(sim.texts()); break;
      // the application's own switch (app/state.ts), as its Theme command does it
      case "cmd": {
        const ui = (globalThis as { __pocketUI?: { commands: { run(id: string): boolean } } }).__pocketUI;
        if (!ui?.commands.run(arg)) console.log(`cmd ${arg}: not offered`);
        await sim.run(3);
        break;
      }
      case "theme": {
        const set = (globalThis as { __pocketUISetTheme?: (id: string) => void }).__pocketUISetTheme;
        if (set) set(arg);
        else console.log("theme: this application sets no theme hook");
        await sim.run(3);
        break;
      }
      default: throw new Error(`unknown step ${op}`);
    }
    for (const line of sim.logs()) console.log(line);
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (name: string) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
  const manifest = argv[0] && !argv[0].startsWith("--") ? argv[0] : join(POCKETUI, "gallery/pocket.app.json");
  const started = performance.now();
  const guest = await buildGuest(manifest);
  const size = argv.includes("--psp") ? null : ((opt("--size") ?? "640x360").split("x").map(Number) as [number, number]);
  const sim = await bootSim(guest, { size });
  await sim.run(30);
  for (const line of sim.logs()) console.log(line);
  await runSteps(sim, opt("--do") ?? "");
  const shot = opt("--shot");
  if (shot) sim.shot(shot);
  console.log(`done in ${Math.round(performance.now() - started)} ms`);
  process.exit(0);
}
