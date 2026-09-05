import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export async function buildRtcVoice() {
  await mkdir('assets/dist', { recursive: true });
  await build({
    entryPoints: ['assets/js/voice/rtc-entry.js'],
    outfile: 'assets/dist/rtc-voice.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    supported: { 'template-literal': false },
    minify: true,
    legalComments: 'none'
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildRtcVoice();
  console.log('build:rtc generated assets/dist/rtc-voice.js');
}
