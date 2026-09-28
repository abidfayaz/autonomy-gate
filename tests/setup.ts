import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/** `next/navigation` needs a router context that jsdom does not provide. */
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
