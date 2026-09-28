/**
 * Toolchain pin drift guard: package.json#engines, .bun-version, .nvmrc, and the
 * Bun version pinned in GitHub workflows must agree.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const pkg = JSON.parse(read('package.json')) as { engines?: { bun?: string; node?: string } };
const bunVersion = read('.bun-version').trim();
const nvmrc = read('.nvmrc').trim();

describe('toolchain pins', () => {
  it('.bun-version is an exact semver', () => {
    expect(bunVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package.json#engines.bun matches .bun-version', () => {
    expect(pkg.engines?.bun).toBe(bunVersion);
  });

  it('every workflow bun-version pin matches .bun-version', () => {
    const dir = join(root, '.github', 'workflows');
    const pins = readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .flatMap((f) =>
        [...read(join('.github', 'workflows', f)).matchAll(/bun-version:\s*['"]?([^\s'"]+)/g)].map((m) => ({ f, v: m[1] })),
      );
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) expect(pin, pin.f).toEqual({ f: pin.f, v: bunVersion });
  });

  it('package.json#engines.node lower bound matches .nvmrc major', () => {
    expect(nvmrc).toMatch(/^\d+$/);
    expect(pkg.engines?.node).toBe(`>=${nvmrc}`);
  });
});
