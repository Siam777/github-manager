---
name: npm-package-release
description: >-
  Standardized guide for building, versioning, testing, bundling (tsup),
  and publishing high-quality, cross-platform TypeScript CLI tools to npm.
---

# Professional NPM Package Release & Distribution Guide

This skill defines the end-to-end workflow for building, packaging, and publishing the `octomux` CLI package.

---

## 1. Package Configuration Best Practices (`package.json`)

Ensure the following fields are defined in `package.json`:

```json
{
  "name": "octomux",
  "version": "1.0.0",
  "description": "Enterprise-grade cross-platform GitHub multi-account & SSH identity manager",
  "type": "module",
  "bin": {
    "octomux": "./dist/bin/octomux.js",
    "omx": "./dist/bin/octomux.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ --ext .ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run typecheck && npm run test && npm run build"
  }
}
```

---

## 2. Bundling with `tsup` (`tsup.config.ts`)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/octomux': 'bin/octomux.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

---

## 3. Pre-Publish Checklist & Verification

1. **Type Checking**: `npm run typecheck` (ensure 0 errors).
2. **Automated Unit Tests**: `npm run test` (all tests passing across platforms).
3. **Local Linking Test**:
   ```bash
   npm link
   omx --help
   octomux --version
   npm unlink -g octomux
   ```
4. **Dry Run Packing**:
   ```bash
   npm pack --dry-run
   ```
   Inspect the archive contents to verify only `dist/`, `README.md`, and `LICENSE` are included.

5. **Publish to NPM**:
   ```bash
   npm publish --access public --provenance
   ```
