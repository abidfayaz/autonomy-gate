/**
 * Stand-in for the `server-only` package under test.
 *
 * That package throws when a server module is pulled into a client bundle. The
 * jsdom test environment looks like a client to it, so server modules could not
 * be unit-tested at all. Aliasing it here weakens nothing real: Next still
 * enforces the boundary at build time, and a build that leaked a credential
 * would fail there.
 */
export {};
