// The shared page lifecycle mounts and disposes voice on SPA navigation.
// Keep this legacy bundle entry side-effect free to avoid two microphone sessions.
export { bootDuplexVoice } from './duplex-controller.js';
