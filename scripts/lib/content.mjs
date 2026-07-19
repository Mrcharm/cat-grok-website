import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

export async function loadMarkdownCollection(directory) {
  const names = (await readdir(directory))
    .filter(name => name.endsWith('.md'))
    .sort();
  const collection = path.basename(directory);
  const defaultBase = collection === 'posts' ? 'writing' : 'projects';

  return Promise.all(names.map(async name => {
    const raw = await readFile(path.join(directory, name), 'utf8');
    const { data, content } = matter(raw);
    for (const field of ['title', 'slug', 'date', 'summary', 'status']) {
      if (!data[field]) {
        throw new Error(directory + '/' + name + ' missing ' + field);
      }
    }
    const normalizedDate = data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date);
    return {
      ...data,
      date: normalizedDate,
      source: name,
      bodyHtml: markdown.render(content),
      url: data.url || defaultBase + '/' + data.slug + '/'
    };
  }));
}
