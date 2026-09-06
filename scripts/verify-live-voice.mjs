// Explicit opt-in integration check; never run as part of unit tests.
import WebSocket from 'ws';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeOutputPcm, downsampleToPcm16 } from '../assets/js/voice/duplex-controller.js';
const url = process.argv[2];
if (!url) throw new Error('Pass the deployed WebSocket URL explicitly');
const ws = new WebSocket(url, { origin: 'https://mrcharm.github.io' });
let phase = 'greeting', chunks = [], pump, answer = '', asr = '', rounds = 0;
const send = e => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(e));
const deadline = setTimeout(() => { console.error('FAIL: integration timeout'); process.exitCode = 1; ws.close(); }, 140000);
async function wav(name, pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  const file = join(tmpdir(), `jarvis-verified-${name}.wav`);
  await writeFile(file, Buffer.concat([header, pcm]));
  console.log('AUDIO', file);
}
ws.on('message', async raw => {
  const e = JSON.parse(raw);
  if (e.type === 'error') { console.error('FAIL', e.error?.code); process.exitCode = 1; ws.close(); return; }
  if (e.type === 'session.created') send({type:'input_audio_mute.commit'});
  if (e.type === 'conversation.item.input_audio_transcription.completed') { asr=e.transcript||e.text||''; console.log('ASR', asr); }
  if (e.type === 'response.output_text.delta') answer += e.delta || e.text || '';
  if (e.type === 'response.output_audio.delta') {
    try { chunks.push(decodeOutputPcm(Buffer.from(e.delta, 'base64'))); }
    catch { console.error('FAIL: output format mismatch'); process.exitCode=1; ws.close(); }
  }
  if (e.type !== 'response.output_audio.done' || !chunks.length) return;
  const samples = new Float32Array(chunks.reduce((n,x)=>n+x.length,0));
  let offset=0; for (const c of chunks) { samples.set(c,offset); offset+=c.length; } chunks=[];
  const pcm = Buffer.from(downsampleToPcm16(samples,24000,24000));
  console.log('ROUND',phase,'seconds',samples.length/24000,'peak',samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0));
  if (phase==='greeting') {
    await wav('female-greeting',pcm);
    phase='question'; send({type:'speech_text_buffer.commit',text:'你好，请问一加一等于几？'});
  } else if (phase==='question') {
    phase='answer'; answer=''; const input=Buffer.from(downsampleToPcm16(samples,24000)); let cursor=0;
    send({type:'input_audio_unmute.commit'});
    pump=setInterval(()=>{const frame=Buffer.alloc(640); if(cursor<input.length) input.copy(frame,0,cursor,Math.min(cursor+640,input.length)); cursor+=640; send({type:'input_audio_buffer.append',audio:frame.toString('base64')});},20);
  } else if (phase==='answer') {
    clearInterval(pump); send({type:'input_audio_mute.commit'}); await wav('model-answer',pcm);
    console.log('ANSWER',answer); rounds++; phase='idle';
    setTimeout(()=>{phase='continuity';send({type:'speech_text_buffer.commit',text:'我还在这里，你可以继续和我说话。'});},65000);
  } else if (phase==='continuity') {
    console.log(rounds && asr ? 'PASS: real ASR, model audio and 65-second continuity' : 'FAIL: missing ASR');
    if (!rounds||!asr) process.exitCode=1;
    ws.close();
  }
});
ws.on('close',()=>{clearTimeout(deadline);clearInterval(pump);if(phase!=='continuity') {console.error('FAIL: premature close',phase);process.exitCode=1;}});
ws.on('error',()=>{console.error('FAIL: connection');process.exitCode=1;});
