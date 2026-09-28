/**
 * Which provider is in use, without loading either.
 *
 * Safe to call from anywhere on the server: it reads the environment and
 * nothing else, so a page that only needs to say what is configured does not
 * pull an SDK in behind it.
 */
export interface JudgmentStatus {
  live: boolean;
  name: "typesafe" | "mock";
}

export function judgmentProviderStatus(): JudgmentStatus {
  const configured = Boolean(process.env.TYPESAFE_API_KEY?.trim());
  return configured ? { live: true, name: "typesafe" } : { live: false, name: "mock" };
}
