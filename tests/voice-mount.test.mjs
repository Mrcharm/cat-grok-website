import test from 'node:test';
import assert from 'node:assert/strict';
import { bootDuplexVoice } from '../assets/js/voice/duplex-controller.js';

class Node extends EventTarget {
  constructor() { super(); this.dataset = {}; this.children = []; this.attrs = {}; this.textContent = ''; this.classList = { add() {}, remove() {} }; }
  setAttribute(k,v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  remove() {}
}

test('voice mount is single and a disposed mount cannot overwrite the replacement status', async () => {
  const selectors = ['#voiceDock','#voiceBtn','#voiceStatus','#transcriptToast','#userInput','#sendBtn','[data-focus-voice]'];
  const elements = new Map(selectors.map(s => [s,new Node()]));
  elements.get('#voiceDock').dataset.voiceEndpoint = 'https://voice.invalid';
  const root = { querySelector: s => elements.get(s), createElement: () => new Node(), defaultView: new EventTarget() };
  const original = globalThis.window;
  globalThis.window = { AudioContext: class {} };
  try {
    const first = bootDuplexVoice({ root });
    assert.equal(bootDuplexVoice({ root }), first);
    first.destroy();
    const second = bootDuplexVoice({ root });
    assert.notEqual(first,second);
    await new Promise(resolve => setTimeout(resolve,0));
    assert.equal(elements.get('#voiceStatus').textContent, 'JARVIS 已就绪');
    second.destroy();
  } finally { globalThis.window = original; }
});
