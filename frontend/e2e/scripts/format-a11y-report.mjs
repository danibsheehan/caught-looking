#!/usr/bin/env node
// Renders frontend/a11y-report.json (written by e2e/a11y.spec.ts) as a Markdown
// summary for the sticky PR comment posted by the `a11y` job in
// .github/workflows/pages-preview.yml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(__dirname, '..', '..', 'a11y-report.json');
const OUT_PATH = path.join(__dirname, '..', '..', 'a11y-report.md');

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function loadReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
}

function countByImpact(pages) {
  const counts = Object.fromEntries(IMPACT_ORDER.map((impact) => [impact, 0]));
  for (const { violations } of pages) {
    for (const violation of violations) {
      const impact = violation.impact ?? 'minor';
      counts[impact] = (counts[impact] ?? 0) + 1;
    }
  }
  return counts;
}

function renderPage({ route, violations }) {
  if (violations.length === 0) {
    return `#### \`${route}\`\n\nNo violations detected.\n`;
  }
  const rows = violations
    .map((v) => {
      const nodes = v.nodes.length;
      return `| ${v.impact ?? 'minor'} | [\`${v.id}\`](${v.helpUrl}) | ${v.help} | ${nodes} |`;
    })
    .join('\n');
  return [
    `#### \`${route}\` — ${violations.length} rule${violations.length === 1 ? '' : 's'} failing`,
    '',
    '| Impact | Rule | Description | Elements |',
    '| --- | --- | --- | --- |',
    rows,
    '',
  ].join('\n');
}

const report = loadReport();

let body;
if (!report || report.results.length === 0) {
  body = '### Accessibility (axe-core) report\n\nNo results were recorded for this run.\n';
} else {
  const counts = countByImpact(report.results);
  const summary = IMPACT_ORDER.map((impact) => `${counts[impact]} ${impact}`).join(', ');
  body = [
    '### Accessibility (axe-core) report',
    '',
    `Scanned ${report.results.length} page(s) against the deployed preview. Violation totals: ${summary}.`,
    '',
    'Informational only for now -- see the axe rule links below for details.',
    '',
    ...report.results.map(renderPage),
  ].join('\n');
}

fs.writeFileSync(OUT_PATH, body);
