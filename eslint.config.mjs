import next from "eslint-config-next";

/**
 * Flat config, because `next lint` was removed in Next 16 and the CLI is now the
 * only entry point. Generated output and dependencies are excluded; everything
 * the project actually authors is linted.
 */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "data/seed/**",
      "design/**",
      "next-env.d.ts",
    ],
  },
  ...next,
];
