import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export async function buildVoice() {
  await mkdir('assets/dist', { recursive: true });
  await build({
    entryPoints: ['assets/js/voice/duplex-entry.js'],
    outfile: 'assets/dist/duplex-voice.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none'
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildVoice();
  console.log('build:voice generated assets/dist/duplex-voice.js');
}
