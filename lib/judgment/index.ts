import type { JudgmentProvider } from "./JudgmentProvider";
import { MockJevProvider } from "./MockJevProvider";
import { judgmentProviderStatus } from "./status";

/**
 * Chooses the judgment provider.
 *
 * Selection is configuration, not code: with a credential the real provider
 * answers, without one the mock does. Nothing above this line changes either
 * way, and the response always says which one it was.
 */
export async function getJudgmentProvider(): Promise<JudgmentProvider> {
  if (!judgmentProviderStatus().live) return new MockJevProvider();
  // Loaded only when it will be used, so the SDK never enters a build that has
  // no credential to give it.
  const { TypeSafeJevProvider } = await import("./TypeSafeJevProvider");
  return new TypeSafeJevProvider();
}

export * from "./JudgmentProvider";
export { MockJevProvider } from "./MockJevProvider";
export { judgmentProviderStatus, type JudgmentStatus } from "./status";
