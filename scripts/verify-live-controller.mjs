import WebSocket from 'ws';
import { DuplexVoiceController, decodeOutputPcm } from '../assets/js/voice/duplex-controller.js';
// Opt-in: uses synthesized audio through the real capture callback/controller.
// Does not test the user's physical microphone or speakers.
const url=process.argv[2];
if (!url) throw Error('Pass the deployed WebSocket URL explicitly');
const question = await new Promise((resolve,reject)=>{
 const ws=new WebSocket(url,{origin:'https://mrcharm.github.io'});let phase=0,chunks=[];
 const timer=setTimeout(()=>{ws.close();reject(Error('question timeout'));},30000);
 ws.on('message',raw=>{const e=JSON.parse(raw);if(e.type==='session.created')ws.send(JSON.stringify({type:'input_audio_mute.commit'}));
 if(e.type==='response.output_audio.delta'&&phase)chunks.push(decodeOutputPcm(Buffer.from(e.delta,'base64')));
 if(e.type==='response.output_audio.done'){if(!phase){phase=1;ws.send(JSON.stringify({type:'speech_text_buffer.commit',text:'请问一加一等于几？'}));}else{clearTimeout(timer);ws.close();resolve(chunks);}}});ws.on('error',reject);
});
let captured;let callbacks=0;let completed=false;
class Socket extends WebSocket {constructor(url){super(url,{origin:'https://mrcharm.github.io'});this.on('message',raw=>{const e=JSON.parse(raw);if(e.type==='response.output_text.done')completed=true;if(!e.type.includes('delta'))console.log('EVENT',e.type,e.response_id||'',e.transcript||e.text||'');});} send(raw){const e=JSON.parse(raw);if(!e.type.includes('append'))console.log('SEND',e.type);super.send(raw);}}
class AudioContext {constructor(options={}){this.sampleRate=options.sampleRate||24000;this.state='running';this.currentTime=0;this.destination={};}async resume(){}async close(){this.state='closed';}createMediaStreamSource(){return{connect(){},disconnect(){}};}createScriptProcessor(){captured={connect(){},disconnect(){}};return captured;}createBuffer(c,n,r){return{duration:n/r,getChannelData:()=>new Float32Array(n)};}createBufferSource(){return{connect(){},start(){callbacks++;},stop(){}};}}
const transcripts=[];const track={muted:false,readyState:'live',stop(){}};
const endpoint=url.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/voice$/,'');
const c=new DuplexVoiceController({endpoint,WebSocketCtor:Socket,AudioContextCtor:AudioContext,mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})},onTranscript:t=>{transcripts.push(t);},onError:e=>console.log('ERROR',e.message)});
await c.start();
const all=new Float32Array(question.reduce((n,x)=>n+x.length,0));let pos=0;for(const chunk of question){all.set(chunk,pos);pos+=chunk.length;}pos=-24000*5;
const pump=setInterval(()=>{const data=new Float32Array(1024);if(pos>=0&&pos<all.length)data.set(all.subarray(pos,pos+1024));pos+=1024;captured.onaudioprocess({inputBuffer:{getChannelData:()=>data}});},1024/24);
setTimeout(async()=>{clearInterval(pump);await c.stop();const user=transcripts.findLast(t=>t.speaker==='user')?.text;const assistant=transcripts.findLast(t=>t.speaker==='assistant')?.text;console.log('RESULT',JSON.stringify({callbacks,user,assistant,completed}));if(!user||!assistant?.includes('2')||callbacks<10||!completed)process.exitCode=1;},30000);
