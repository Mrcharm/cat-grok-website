import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeGeneratedFiles(files) {
  for (const [relative, html] of files) {
    await mkdir(path.dirname(relative), { recursive: true });
    await writeFile(relative, html, 'utf8');
  }
}
