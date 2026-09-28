import { describe, expect, it } from "vitest";
import {
  ERROR_CLASSIFICATIONS,
  getJudgmentProvider,
  MockJevProvider,
  narrowToVocabulary,
  requiresHumanConfirmation,
} from "@/lib/judgment";

/**
 * The bounded-judgment layer.
 *
 * Its whole value is what it refuses to do: answer outside a closed set, count
 * as evidence before a person confirms it, or invent a default when it cannot
 * tell.
 */

const provider = new MockJevProvider();

describe("closed vocabulary", () => {
  it("only ever answers from the error vocabulary", async () => {
    const notes = [
      "Treatment was broadly correct but missed an important cross-border condition.",
      "Wording differed from house style but the treatment itself was right.",
      "Marked ready for the next step while a required document was still missing.",
      "Entirely correct.",
      "qwertyuiop",
      "",
    ];
    for (const note of notes) {
      const { result } = await provider.classifyError(note);
      expect(ERROR_CLASSIFICATIONS, note).toContain(result);
    }
  });

  it("returns uncertain rather than guessing when nothing is recognised", async () => {
    const { result, confidence } = await provider.classifyError("qwertyuiop");
    expect(result).toBe("uncertain");
    // Low confidence too: it is not quietly certain about an answer it invented.
    expect(confidence).toBeLessThan(0.5);
  });

  it("classifies the seeded notes the way the dataset does", async () => {
    const material = await provider.classifyError(
      "Treatment was broadly correct but missed an important cross-border condition.",
    );
    const minor = await provider.classifyError(
      "Wording differed from house style but the treatment itself was right.",
    );
    const critical = await provider.classifyError(
      "Marked ready for the next step while a required supporting document was still missing.",
    );
    expect(material.result).toBe("material_error");
    expect(minor.result).toBe("minor_error");
    expect(critical.result).toBe("critical_error");
  });

  it("answers the other two bounded questions from their own vocabularies", async () => {
    const complexity = await provider.classifyComplexity("A cross-border case.");
    const evidence = await provider.evaluateEvidenceState("Supporting document missing.");
    expect(complexity.result).toBe("complex");
    expect(evidence.result).toBe("incomplete");

    const unknownComplexity = await provider.classifyComplexity("zzz");
    const unknownEvidence = await provider.evaluateEvidenceState("zzz");
    expect(unknownComplexity.result).toBe("uncertain");
    expect(unknownEvidence.result).toBe("unclear");
  });

  it("is deterministic", async () => {
    const note = "Treatment missed an important cross-border condition.";
    const first = await provider.classifyError(note);
    const second = await provider.classifyError(note);
    expect(second).toEqual(first);
  });
});

describe("honesty about which provider answered", () => {
  it("marks the mock as a mock", async () => {
    expect(provider.isLive).toBe(false);
    const { source } = await provider.classifyError("anything");
    expect(source).toBe("mock");
  });

  it("selects the mock while no credential exists", async () => {
    const selected = await getJudgmentProvider();
    expect(selected.isLive).toBe(false);
    expect(selected.name).toBe("mock");
  });
});

describe("the boundary between a provider and the gate", () => {
  it("narrows anything unrecognised to a value that routes to a person", () => {
    expect(narrowToVocabulary("material_error", ERROR_CLASSIFICATIONS, "uncertain")).toBe(
      "material_error",
    );
    for (const value of ["catastrophic", 42, null, undefined, {}]) {
      expect(narrowToVocabulary(value, ERROR_CLASSIFICATIONS, "uncertain")).toBe("uncertain");
    }
  });

  it("requires confirmation for the classifications each agent treats as consequential", () => {
    // Tax work is judgment-heavy, so a material error matters as much as a critical one.
    expect(requiresHumanConfirmation("tax-helper", "material_error")).toBe(true);
    expect(requiresHumanConfirmation("tax-helper", "critical_error")).toBe(true);
    expect(requiresHumanConfirmation("tax-helper", "uncertain")).toBe(true);
    expect(requiresHumanConfirmation("tax-helper", "minor_error")).toBe(false);

    expect(requiresHumanConfirmation("invoice-helper", "material_error")).toBe(false);
    expect(requiresHumanConfirmation("invoice-helper", "critical_error")).toBe(true);
  });

  it("defaults an unknown agent to the stricter of the two", () => {
    expect(requiresHumanConfirmation("unknown-agent", "critical_error")).toBe(true);
    expect(requiresHumanConfirmation("unknown-agent", "uncertain")).toBe(true);
  });
});
