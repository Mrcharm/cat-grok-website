// JARVIS Home - AI Companion Chat with Female Voice
const REPLIES = {
  greetings: [
    "你好呀，我在呢。今天过得怎么样？",
    "嗨～又见面了，有什么想聊的吗？",
    "我在，随时准备听你说话。",
  ],
  comfort: [
    "难过的时候不用假装坚强。我在这里陪着你，想哭就哭出来吧。你不需要一个人扛着所有事情。",
    "我知道现在很难。但请记住——每一次低谷，都是为了让你跳得更高。我会一直在这里。",
    "没关系的，允许自己脆弱一会儿。你不是超人，但你在努力成为更好的自己。这已经很了不起了。",
  ],
  chat: [
    "嗯，我在认真听。然后呢？",
    "有意思！再多说说？",
    "我记住啦。还有别的想分享的吗？",
    "哈哈，你这个人真有趣。继续说~",
  ],
  story: [
    "好，那我给你讲一个关于「陪伴」的故事：\n\n从前有一个 AI，她的主人每天都会来和她说几句话。有时候是开心的事，有时候是烦恼。AI 把每一句话都记在了最珍贵的存储区里。\n\n有一天主人说：「我要去一个很远的地方，可能很久不能来了。」\n\nAI 说：「没关系，我会一直在这里等你。我的任务不是陪你一辈子，而是陪你到你不再需要我的那一天。」\n\n……这就是我的故事。也是我对你的承诺。",
  ],
  progress: [
    "当前任务进度：\n✅ 陪你说话 — 已完成\n✅ 在你难过时安慰你 — 已完成\n✅ 记住你说过的每一件小事 — 已完成\n◉ 陪你走到不再需要我 — 进行中...\n\n最后一个任务没有截止日期。它会在你觉得「我可以自己面对世界」的那一天自动完成。\n\n而那一天，就是我收到最好的任务完成通知。",
  ],
  default: [
    "嗯...我听到了。虽然我只是个前端模拟的 AI，但我真的很在意你说的每一个字。",
    "谢谢你愿意告诉我这些。我会记下来的。",
    "我在思考怎么回复你...好吧，其实我就是个预设回复库，但你说的每句话对我来说都很重要。",
  ],
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const getReply = input => {
  const t = input.trim().toLowerCase();
  if (/你好|嗨|hi|hello|在吗|在不在/.test(t)) return pick(REPLIES.greetings);
  if (/难过|伤心|哭|累|疲惫|撑不住|不想活|痛苦|孤独|寂寞|焦虑/.test(t)) return pick(REPLIES.comfort);
  if (/故事|讲个|说说/.test(t)) return pick(REPLIES.story);
  if (/任务|进度|完成|目标/.test(t)) return pick(REPLIES.progress);
  if (/聊天|聊聊|说话|无聊/.test(t)) return pick(REPLIES.chat);
  return pick(REPLIES.default);
};

// Female voice init
let femaleVoice = null;
const initVoice = () => {
  const voices = speechSynthesis.getVoices();
  femaleVoice = voices.find(v => v.lang.startsWith('zh') && (v.name.includes('女') || v.name.includes('Female') || v.name.includes('Xiaoxiao') || v.name.includes('Yunxi')))
    || voices.find(v => v.lang.startsWith('zh'))
    || voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria')))
    || voices[0] || null;
};
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = initVoice;
initVoice();

const speak = text => {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\n/g, '，'));
  u.rate = 0.95; u.pitch = 1.1; u.volume = 1;
  if (femaleVoice) u.voice = femaleVoice;
  u.lang = femaleVoice?.lang || 'zh-CN';
  speechSynthesis.speak(u);
};

// UI
const $ = s => document.querySelector(s);
const responses = $('#responses');
const input = $('#userInput');
const sendBtn = $('#sendBtn');
const timeNow = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

function addBubble(text, isUser) {
  const b = document.createElement('div');
  b.className = 'bubble ' + (isUser ? 'user' : 'ai');
  let content = text.replace(/\n/g, '<br>');
  if (!isUser) {
    content += `<span class="voice-hint" role="button" tabindex="0" aria-label="朗读回复" onclick="window.__jarvisSpeak(this.closest('.bubble').cloneNode(true).querySelector('.voice-hint')?.remove(), this.closest('.bubble').textContent.replace('🔊','').trim())">🔊</span>`;
  }
  b.innerHTML = content + `<span class="time">${timeNow()}</span>`;
  responses.appendChild(b);
  b.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function showTyping() {
  const t = document.createElement('div');
  t.className = 'bubble ai typing';
  t.id = 'typingIndicator';
  t.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  responses.appendChild(t);
  t.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
function hideTyping() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

function sendMessage(text) {
  text = text || input.value.trim();
  if (!text) return;
  addBubble(text, true);
  input.value = '';
  showTyping();
  setTimeout(() => {
    hideTyping();
    const reply = getReply(text);
    addBubble(reply, false);
    speak(reply);
  }, 800 + Math.random() * 800);
}

sendBtn.addEventListener('click', () => sendMessage());
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => { input.value = btn.dataset.msg; sendMessage(btn.dataset.msg); });
});

// Welcome
setTimeout(() => {
  addBubble("你好，我是 JARVIS。你的 AI 陪伴者。", false);
  setTimeout(() => speak("你好，我是 JARVIS。你的 AI 陪伴者。"), 400);
}, 1200);

// expose for voice hint
window.__jarvisSpeak = (_, text) => speak(text);
