import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadAndValidateContent } from './validate-content.mjs';
import { writeGeneratedFiles } from './lib/render.mjs';
import { renderPages } from './templates/pages.mjs';

export async function buildSite({ write = true } = {}) {
  const data = await loadAndValidateContent();
  const [blogRaw, skillsRaw] = await Promise.all([
    readFile('data/blog.json', 'utf8').catch(() => '{"items":[]}'),
    readFile('data/skills.json', 'utf8').catch(() => '{"categories":[]}')
  ]);
  const blog = JSON.parse(blogRaw);
  const skills = JSON.parse(skillsRaw);
  const files = renderPages({ ...data, blog, skills });
  if (write) await writeGeneratedFiles(files);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log('build: generated ' + files.size + ' pages');
}
