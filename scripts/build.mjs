import { pathToFileURL } from 'node:url';
import { loadAndValidateContent } from './validate-content.mjs';
import { loadMarkdownCollection } from './lib/content.mjs';
import { writeGeneratedFiles } from './lib/render.mjs';
import { renderPages } from './templates/pages.mjs';

export async function buildSite({ write = true } = {}) {
  const data = await loadAndValidateContent();
  const [posts, projects] = await Promise.all([
    loadMarkdownCollection('content/posts'),
    loadMarkdownCollection('content/projects')
  ]);
  const files = renderPages({ ...data, posts, projects });
  if (write) await writeGeneratedFiles(files);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log('build: generated ' + files.size + ' pages');
}
