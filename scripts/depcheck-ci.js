#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');

function run() {
  try {
    const json = execSync('npx depcheck --json', { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const report = JSON.parse(json);
    const hasIssues = (report.dependencies && report.dependencies.length) ||
      (report.devDependencies && report.devDependencies.length) ||
      (report.missing && Object.keys(report.missing).length);

    if (hasIssues) {
      console.error('[depcheck] Unused/invalid dependencies found');
      console.error(JSON.stringify(report, null, 2));
      process.exit(1);
    } else {
      console.log('[depcheck] No unused or missing dependencies found');
    }
  } catch (err) {
    // If depcheck exits non-zero (e.g., parse errors), surface output
    if (err.stdout) {
      try {
        const report = JSON.parse(String(err.stdout));
        console.error('[depcheck] Issues found');
        console.error(JSON.stringify(report, null, 2));
      } catch (_) {
        console.error(String(err.stdout));
      }
    }
    if (err.stderr) console.error(String(err.stderr));
    process.exit(1);
  }
}

run();
