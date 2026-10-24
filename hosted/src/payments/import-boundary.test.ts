import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const forbidden = [
  ['src/payments/leak.ts', 'import "convex";'],
  ['src/payments/leak.ts', 'import "convex/server";'],
  ['src/payments/leak.ts', 'import "@convex-dev/react";'],
  ['src/payments/leak.ts', 'import "../../convex/schema.js";'],
  ['src/payments/adapters/fake/leak.ts', 'import "../../../../convex/schema.js";'],
  ['src/payments/leak.ts', 'import "../../convex";'],
  ['src/payments/leak.js', 'import "convex";'],
  ['src/payments/leak.mjs', 'import "convex";'],
  ['src/payments/leak.cjs', 'import "convex";'],
  ['src/payments/leak.mts', 'import "convex";'],
  ['src/payments/leak.cts', 'import "convex";'],
  ['src/payments/leak.tsx', 'import "convex";'],
  ['src/payments/leak.ts', 'import "@polar-sh/sdk";'],
  ['convex/entitlement.ts', 'import "@polar-sh/sdk";'],
  ['src/payments/adapters/fake/leak.ts', 'import "@polar-sh/sdk";'],
  ['src/payments/leak.ts', 'import "stripe";'],
  ['src/payments/adapters/polar/client.ts', 'import "convex";'],
  ['src/payments/adapters/polar/client.ts', 'import "stripe";'],
  ['src/outside.ts', 'import "@polar-sh/sdk";'],
] as const;

describe('payments import boundary', () => {
  it('rejects Convex and payment SDK imports outside the Polar adapter', async () => {
    const eslint = new ESLint({ cwd: root });
    for (const [file, source] of forbidden) {
      const [result] = await eslint.lintText(`${source}\n`, {
        filePath: path.join(root, file),
      });
      expect(result?.messages.some((message) => message.ruleId === 'no-restricted-imports'), file + ' ' + source).toBe(
        true,
      );
    }
  });

  it('allows @polar-sh inside the Polar adapter and still rejects Convex there', async () => {
    const eslint = new ESLint({ cwd: root });
    const polarFile = path.join(root, 'src/payments/adapters/polar/client.ts');
    const [allowed] = await eslint.lintText('import "@polar-sh/sdk";\n', { filePath: polarFile });
    expect(allowed?.messages.filter((message) => message.ruleId === 'no-restricted-imports')).toEqual([]);
    expect(allowed?.errorCount).toBe(0);
  });
});
