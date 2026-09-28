import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The engine's central claim is that no model output and no environment can
 * change an autonomy outcome. That is only true if the engine cannot reach
 * either, so it is enforced here rather than left to discipline.
 */

const ENGINE_DIR = resolve(process.cwd(), "lib/engine");

const engineFiles = readdirSync(ENGINE_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, source: readFileSync(resolve(ENGINE_DIR, name), "utf8") }));

/** Anything that would make an outcome depend on something other than its inputs. */
const FORBIDDEN_IMPORTS = [
  "react",
  "next/",
  "node:fs",
  "node:http",
  "node:https",
  "node:child_process",
  "groq-sdk",
  "@typesafe-ai/sdk",
  // Not just the SDKs: nothing in the judgment or explanation layers either, so
  // neither a model's answer nor a usage limit on calling one can reach an
  // outcome. A rate-limited classification must be incapable of moving autonomy.
  "@/lib/judgment",
  "@/lib/explain",
  "@/lib/data/",
  "@/data/",
];

const FORBIDDEN_GLOBALS = [
  "fetch(",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "process.env",
  "Date.now(",
  "new Date(",
  "Math.random(",
];

describe("engine purity", () => {
  it("finds the engine modules", () => {
    expect(engineFiles.length).toBeGreaterThanOrEqual(7);
  });

  it("imports nothing that could make an outcome depend on the environment", () => {
    for (const file of engineFiles) {
      const imports = [...file.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
      for (const specifier of imports) {
        for (const forbidden of FORBIDDEN_IMPORTS) {
          expect(
            specifier.startsWith(forbidden),
            `${file.name} imports ${specifier}`,
          ).toBe(false);
        }
      }
    }
  });

  it("only ever imports domain types or its own siblings", () => {
    for (const file of engineFiles) {
      const imports = [...file.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
      for (const specifier of imports) {
        const allowed =
          specifier.startsWith("./") || specifier.startsWith("@/lib/domain/");
        expect(allowed, `${file.name} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("reads no ambient state and produces no randomness", () => {
    for (const file of engineFiles) {
      for (const global of FORBIDDEN_GLOBALS) {
        expect(file.source.includes(global), `${file.name} uses ${global}`).toBe(false);
      }
    }
  });

  it("never mentions a provider, even in a comment", () => {
    for (const file of engineFiles) {
      for (const term of ["Groq", "TypeSafe", "Jev "]) {
        expect(file.source.includes(term), `${file.name} mentions ${term}`).toBe(false);
      }
    }
  });
});
