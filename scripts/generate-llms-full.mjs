import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.resolve(rootDir, 'docs');
const outputDir = path.resolve(docsDir, 'public');
const outputFile = path.resolve(outputDir, 'llms-full.txt');

// Logical reading order for AI comprehension
const docFiles = [
  'index.md',
  'guide/getting-started.md',
  'guide/why-keyset.md',
  'guide/faq.md',
  'guide/architecture.md',
  'guide/bidirectional.md',
  'guide/search.md',
  'guide/indexing.md',
  'security/cryptographic-protection.md',
  'databases/postgresql.md',
  'databases/sqlite.md',
  'databases/mysql.md',
  'api/core.md',
  'api/security.md',
  'api/search-strategies.md'
];

function stripFrontmatter(content) {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      return content.slice(end + 3).trim();
    }
  }
  return content.trim();
}

let fullText = `# KeysetEngine Drizzle — Complete Documentation & Technical Reference
Repository: https://github.com/aebibtech/keysetengine-drizzle
Documentation: https://drizzle.keysetengine.aebibtech.com
License: MIT
Target Runtimes: Node.js 18+, Bun 1.0+
ORM: Drizzle ORM (>=0.35.0)

This file provides the complete, concatenated documentation for KeysetEngine Drizzle formatted as unformatted Markdown for LLMs and AI coding assistants.

================================================================================
`;

for (const relPath of docFiles) {
  const absPath = path.resolve(docsDir, relPath);
  if (fs.existsSync(absPath)) {
    const raw = fs.readFileSync(absPath, 'utf8');
    const cleaned = stripFrontmatter(raw);
    fullText += `\n\n<!-- FILE: ${relPath} -->\n\n${cleaned}\n\n================================================================================`;
  }
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, fullText, 'utf8');
console.log(`[llms.txt] Successfully generated ${outputFile} (${(fullText.length / 1024).toFixed(1)} KB)`);
