import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadAndValidateContent } from './validate-content.mjs';
import { writeGeneratedFiles } from './lib/render.mjs';
import { renderPages } from './templates/pages.mjs';
import { normalizeHomeDocument } from './templates/home-document.mjs';
import { homeHighlights } from './templates/home-highlights.mjs';

export async function buildSite({ write = true } = {}) {
  const data = await loadAndValidateContent();
  const [blogRaw, skillsRaw, homeRaw] = await Promise.all([
    readFile('data/blog.json', 'utf8').catch(() => '{"items":[]}'),
    readFile('data/skills.json', 'utf8').catch(() => '{"categories":[]}'),
    readFile('index.html', 'utf8')
  ]);
  const blog = JSON.parse(blogRaw);
  const skills = JSON.parse(skillsRaw);
  const files = renderPages({ ...data, blog, skills });
  const home = homeRaw.replace(/<!-- HOME_HIGHLIGHTS_START -->[\s\S]*?<!-- HOME_HIGHLIGHTS_END -->/, '<!-- HOME_HIGHLIGHTS_START -->' + homeHighlights(blog, skills) + '<!-- HOME_HIGHLIGHTS_END -->');
  files.set('index.html', normalizeHomeDocument(home));
  if (write) await writeGeneratedFiles(files);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log('build: generated ' + files.size + ' pages');
}
