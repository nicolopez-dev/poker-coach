#!/usr/bin/env node
// Pre-build for design-sync (cfg.buildCmd). Poker Coach is an Expo app, not a published
// library, so there is no dist/ for the converter to read. This makes one, from the real
// source, in the shape the converter expects:
//
//   .ds-sync/dspkg/
//     package.json          name/version/module/types
//     dist/index.mjs        .design-sync/ds-entry.ts bundled for the web: react-native is
//                           react-native-web, *.web.* files win, react stays external
//     types/                tsc declarations for the same entry (index.d.ts at the root)
//     styles/tokens.css     src/theme/tokens.ts as CSS custom properties + type classes
//     fonts/fonts.css       @font-face for the two Archivo cuts the app loads, under the
//                           exact family names tokens.ts uses (Archivo_400Regular, …)
//
// Nothing here restyles or reimplements a component; every value is read from the source.
// Run from the repo root: node .design-sync/build-dist.mjs

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = resolve('.ds-sync/dspkg');
const ENTRY = resolve('.design-sync/ds-entry.ts');
const { build } = await import(pathToFileURL(resolve('.ds-sync/node_modules/esbuild/lib/main.js')).href);

rmSync(OUT, { recursive: true, force: true });
for (const d of ['dist', 'types', 'styles', 'fonts']) mkdirSync(join(OUT, d), { recursive: true });

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, module: 'dist/index.mjs', types: 'types/index.d.ts' }, null, 2) + '\n',
);

// -- 1. the web bundle ------------------------------------------------------
// react-native -> react-native-web is what Expo's own web target does; the .web.*
// resolve order is how expo-linear-gradient, expo-blur and react-native-svg pick their
// DOM implementations.
const rnw = {
  name: 'react-native-web',
  setup(b) {
    b.onResolve({ filter: /^react-native$/ }, (args) =>
      b.resolve('react-native-web', { resolveDir: args.resolveDir, kind: args.kind }));
  },
};
await build({
  entryPoints: [ENTRY],
  outfile: join(OUT, 'dist/index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  plugins: [rnw],
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  mainFields: ['browser', 'module', 'main'],
  loader: { '.png': 'dataurl', '.ttf': 'dataurl', '.js': 'jsx' },
  define: {
    __DEV__: 'false',
    'process.env.NODE_ENV': '"development"',
    'process.env.EXPO_OS': '"web"',
    global: 'globalThis',
  },
  logLevel: 'warning',
});

// -- 2. declarations --------------------------------------------------------
const tsconfig = join(OUT, 'tsconfig.json');
writeFileSync(tsconfig, JSON.stringify({
  extends: '../../tsconfig.json',
  compilerOptions: {
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: './types',
    rootDir: '../..',
  },
  files: ['../../.design-sync/ds-entry.ts'],
}, null, 2));
try {
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', tsconfig], { stdio: 'pipe' });
} catch (e) {
  // Declarations are still written on a type error elsewhere in the program; say so.
  console.error(`  ! tsc reported errors (declarations emitted anyway):\n${String(e.stdout).slice(0, 2000)}`);
}
// Hoist the entry to types/index.d.ts: the converter globs the types root and skips dot
// directories, so it must not live under types/.design-sync/.
const entryDts = readFileSync(join(OUT, 'types/.design-sync/ds-entry.d.ts'), 'utf8');
writeFileSync(join(OUT, 'types/index.d.ts'), entryDts.replaceAll("'../src/", "'./src/"));
rmSync(join(OUT, 'types/.design-sync'), { recursive: true, force: true });

// -- 3. tokens as CSS -------------------------------------------------------
// tokens.ts imports Platform for one value; stub it so the module runs in node.
const tokensOut = join(OUT, '.tokens.mjs');
await build({
  entryPoints: [resolve('src/theme/tokens.ts')],
  outfile: tokensOut,
  bundle: true,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'rn-stub',
    setup(b) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'rn', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: "export const Platform = { OS: 'web' };" }));
    },
  }],
  logLevel: 'warning',
});
const t = await import(pathToFileURL(tokensOut).href + `?${Date.now()}`);
rmSync(tokensOut);

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const px = (n) => (typeof n === 'number' ? `${+n.toFixed(3)}px` : n);
const gradient = (deg, stops, at) => `linear-gradient(${deg}deg, ${stops.map((c, i) => `${c} ${+(at[i] * 100).toFixed(2)}%`).join(', ')})`;

const vars = [];
for (const [k, v] of Object.entries(t.colors)) {
  if (Array.isArray(v)) v.forEach((c, i) => vars.push(`--pc-${kebab(k)}-${i + 1}: ${c};`));
  else vars.push(`--pc-${kebab(k)}: ${v};`);
}
for (const [k, v] of Object.entries(t.radius)) vars.push(`--pc-radius-${kebab(k)}: ${px(v)};`);
for (const [k, v] of Object.entries(t.shadows)) vars.push(`--pc-shadow-${kebab(k)}: ${v.boxShadow};`);
vars.push(`--pc-font-regular: '${t.font.regular}', system-ui, sans-serif;`);
vars.push(`--pc-font-bold: '${t.font.bold}', system-ui, sans-serif;`);
vars.push(`--pc-touch: ${px(t.TOUCH)};`);
vars.push(`--pc-max-content-width: ${px(t.spacing.maxContentWidth)};`);
// The handoff's angles: 115deg for the metal hairlines, 155deg for the reward fill.
vars.push(`--pc-gold-gradient: ${gradient(115, t.goldGradient, t.goldGradientLocations)};`);
vars.push(`--pc-silver-gradient: ${gradient(115, t.silverGradient, t.silverGradientLocations)};`);
vars.push(`--pc-reward-card-fill: ${gradient(155, t.rewardCardFill, t.rewardCardFillLocations)};`);

// The type scale as classes, for DOM glue. RN line heights are points; in CSS a bare
// number would be a multiplier, so every length gets its unit here.
const typeRules = Object.entries(t.type).map(([k, s]) => {
  const decl = [
    `font-family: '${s.fontFamily}', system-ui, sans-serif`,
    `font-size: ${px(s.fontSize)}`,
    s.lineHeight != null && `line-height: ${px(s.lineHeight)}`,
    s.letterSpacing != null && `letter-spacing: ${px(s.letterSpacing)}`,
    s.textTransform && `text-transform: ${s.textTransform}`,
    s.color && `color: ${s.color}`,
  ].filter(Boolean);
  return `.pc-type-${kebab(k)} { ${decl.join('; ')}; }`;
});

writeFileSync(join(OUT, 'styles/tokens.css'), [
  '/* Generated from src/theme/tokens.ts by .design-sync/build-dist.mjs — do not edit. */',
  `:root {\n  ${vars.join('\n  ')}\n}`,
  ...typeRules,
  '',
].join('\n'));

// -- 4. fonts ---------------------------------------------------------------
// App.tsx loads exactly these two cuts; the family names are the ones tokens.font uses.
const faces = [];
for (const [family, weight] of [[t.font.regular, 400], [t.font.bold, 800]]) {
  const dir = family.replace(/^Archivo_/, '');
  copyFileSync(resolve(`node_modules/@expo-google-fonts/archivo/${dir}/${family}.ttf`), join(OUT, `fonts/${family}.ttf`));
  faces.push(`@font-face { font-family: '${family}'; src: url('./${family}.ttf') format('truetype'); font-weight: ${weight}; font-style: normal; font-display: block; }`);
}
writeFileSync(join(OUT, 'fonts/fonts.css'), faces.join('\n') + '\n');

console.error(`  dspkg: ${OUT.slice(ROOT.length + 1)} (dist, types, styles/tokens.css, fonts)`);
