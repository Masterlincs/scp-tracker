#!/usr/bin/env node
/* eslint-disable no-console */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

async function ensureDir(p) {
  await fse.ensureDir(p);
}

async function clean(dir) {
  await fse.remove(dir);
}

async function copyIfExists(src, dst) {
  const srcPath = path.resolve(process.cwd(), src);
  if (await fse.pathExists(srcPath)) {
    await fse.ensureDir(path.dirname(dst));
    await fse.copy(srcPath, dst);
  }
}

async function build(target, { watch = false } = {}) {
  const outdir = target === 'firefox' ? 'dist-firefox' : (target === 'firefox-mv2' ? 'dist-firefox-mv2' : 'dist-chrome');
  await clean(outdir);
  await ensureDir(outdir);

  const entryPoints = [
    'src/background.js',
    'src/content.js',
    'src/pages/settings/settings.js',
    'src/popup/popup.js',
    'src/pages/onboarding/onboarding.js'
  ];

  const isProd = process.env.NODE_ENV === 'production';

  const buildOptions = {
    entryPoints,
    outdir,
    outbase: 'src',
    bundle: true,
    sourcemap: isProd ? true : 'inline',
    platform: 'browser',
    format: 'iife',
    target: target === 'firefox' ? ['firefox115'] : (target === 'firefox-mv2' ? ['firefox68'] : ['chrome88']),
    minify: isProd,
    treeShaking: true,
    logLevel: 'info',
    metafile: false,
    splitting: false // keep single-file outputs per entry for simpler manifests
  };

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log(`[esbuild] Watching for ${target} -> ${outdir}`);
  } else {
    await esbuild.build(buildOptions);
  }

  // Copy static assets
  const copies = [
    ['assets/icons', path.join(outdir, 'icons')],
    ['assets/data/dictionary.json', path.join(outdir, 'dictionary.json')],
    ['src/styles', path.join(outdir, 'styles')],
    ['assets/styles/content.css', path.join(outdir, 'content.css')],
    ['assets/styles/accessibility.css', path.join(outdir, 'accessibility.css')],
    ['src/pages/settings/settings.css', path.join(outdir, 'pages/settings/settings.css')],
    ['src/popup/popup.html', path.join(outdir, 'popup/popup.html')],
    ['src/pages/settings/settings.html', path.join(outdir, 'pages/settings/settings.html')],
    ['src/pages/onboarding/onboarding.html', path.join(outdir, 'pages/onboarding/onboarding.html')],
    ['manifest.json', path.join(outdir, 'manifest.json')]
  ];

  for (const [src, dst] of copies) {
    await copyIfExists(src, dst);
  }

  // Transform manifest per target
  const manifestPath = path.join(outdir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found in output');
  }
  const manifest = JSON.parse(await fse.readFile(manifestPath, 'utf8'));

  if (target === 'firefox') {
    // Keep MV3 and bump Gecko strict_min_version for service worker support
    if (!manifest.applications) manifest.applications = { gecko: {} };
    if (!manifest.applications.gecko) manifest.applications.gecko = {};
    manifest.applications.gecko.strict_min_version = manifest.applications.gecko.strict_min_version || '115.0';
    await fse.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  } else if (target === 'firefox-mv2') {
    // Convert to MV2 manifest for environments where MV3 service workers are disabled
    const firefoxManifest = {};
    firefoxManifest.manifest_version = 2;
    firefoxManifest.name = manifest.name;
    firefoxManifest.version = manifest.version;
    firefoxManifest.description = manifest.description;

    // Merge host_permissions into permissions for MV2
    const mergedPerms = new Set([...(manifest.permissions || [])]);
    (manifest.host_permissions || []).forEach((p) => mergedPerms.add(p));
    firefoxManifest.permissions = Array.from(mergedPerms);

    // Background scripts instead of service worker
    firefoxManifest.background = { scripts: ['background.js'] };

    // Browser action equivalent of MV3 action
    if (manifest.action) {
      firefoxManifest.browser_action = {
        default_title: manifest.action.default_title,
        default_popup: manifest.action.default_popup
      };
      // Mirror MV3 action.default_icon into MV2 browser_action.default_icon
      if (manifest.action.default_icon) {
        firefoxManifest.browser_action.default_icon = manifest.action.default_icon;
      }
      // Mirror MV3 action.theme_icons into MV2 browser_action.theme_icons
      if (manifest.action.theme_icons) {
        firefoxManifest.browser_action.theme_icons = manifest.action.theme_icons;
      }
    }

    // Preserve options_ui so settings page is available in MV2
    if (manifest.options_ui) {
      firefoxManifest.options_ui = manifest.options_ui;
    }

    // Content scripts carry over as-is
    firefoxManifest.content_scripts = manifest.content_scripts || [];

    // Carry over commands so keyboard shortcuts work in MV2
    if (manifest.commands) {
      firefoxManifest.commands = manifest.commands;
    }

    // MV2 web_accessible_resources must be array of strings
    firefoxManifest.web_accessible_resources = [
      'dictionary.json',
      'accessibility.css',
      'styles/*.css',
      'styles/themes/*.css',
      'icons/*.png'
    ];

    // Applications Gecko stays if present
    if (manifest.applications) firefoxManifest.applications = manifest.applications;

    // Copy top-level icons from MV3 manifest into MV2 manifest
    if (manifest.icons) firefoxManifest.icons = manifest.icons;

    // MV2 CSP string (mirror allowed hosts)
    firefoxManifest.content_security_policy = "script-src 'self'; object-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src https://scp-wiki.wikidot.com https://wanderers-library.wikidot.com https://scp-ru.wikidot.com https://scp-jp.wikidot.com https://scp-es.wikidot.com https://scp-pl.wikidot.com https://scp-fr.wikidot.com https://scp-de.wikidot.com https://scp-it.wikidot.com https://scp-ko.wikidot.com https://scp-zh.wikidot.com https://scp-zh-tr.wikidot.com https://scp-th.wikidot.com https://scp-vn.wikidot.com https://scp-cs.wikidot.com";

    await fse.writeFile(manifestPath, JSON.stringify(firefoxManifest, null, 2));
  } else {
    // Chrome MV3: remove Firefox-only key
    if (manifest.applications) delete manifest.applications;
    await fse.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  console.log(`[esbuild] Built ${target} -> ${outdir}`);
}

(async () => {
  try {
    const target = process.argv[2] || 'chrome';
    const watch = process.argv.includes('--watch');
    await build(target, { watch });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
