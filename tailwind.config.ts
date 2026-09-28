import type { Config } from "tailwindcss";
import tokens from "./design/tokens.json";

/**
 * Design tokens are not hand-transcribed. `design/tokens.json` was extracted
 * programmatically from the approved HTML reference screens, whose four config
 * variants were verified identical (47 colours, 4 radii, 9 spacing steps,
 * 9 type sizes, 0 conflicts). The approved screens are the source of truth for
 * visual direction, so this file adapts them rather than reinterpreting them.
 */

type FontSizeValue = [
  string,
  { lineHeight: string; letterSpacing: string; fontWeight: string },
];

/**
 * JSON imports widen tuples to arrays, so each entry is narrowed explicitly.
 * A malformed token fails the build rather than silently losing type metrics.
 */
function toFontSize(raw: Record<string, unknown>): Record<string, FontSizeValue> {
  return Object.fromEntries(
    Object.entries(raw).map(([name, value]) => {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error(`design/tokens.json: fontSize.${name} must be [size, metrics]`);
      }
      const [size, metrics] = value as [unknown, unknown];
      if (typeof size !== "string" || typeof metrics !== "object" || metrics === null) {
        throw new Error(`design/tokens.json: fontSize.${name} has an unexpected shape`);
      }
      return [name, [size, metrics as FontSizeValue[1]]];
    }),
  );
}

const sansFallback = ["ui-sans-serif", "system-ui", "sans-serif"];
const monoFallback = ["ui-monospace", "SFMono-Regular", "monospace"];

const fontFamily = Object.fromEntries(
  Object.entries(tokens.fontFamily as Record<string, string[]>).map(([key, stack]) => [
    key,
    [...stack, ...(stack[0] === "JetBrains Mono" ? monoFallback : sansFallback)],
  ]),
);

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.borderRadius,
      spacing: tokens.spacing,
      fontFamily,
      fontSize: toFontSize(tokens.fontSize),
    },
  },
  plugins: [],
};

export default config;
