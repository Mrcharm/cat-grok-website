import RTC from '@volcengine/rtc';
import { bootRtcVoice } from './rtc-controller.js';

const {
  createEngine,
  destroyEngine,
  events,
  MediaType,
  RoomProfileType,
  ConnectionState,
  ErrorCode,
  RTCAutoPlayPolicy
} = RTC;

async function requestMicrophonePermission() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const [audioTrack] = stream.getAudioTracks();
  const deviceId = audioTrack?.getSettings().deviceId;
  for (const track of stream.getTracks()) track.stop();
  return deviceId;
}

bootRtcVoice({
  rtc: {
    createEngine,
    destroyEngine,
    events,
    MediaType,
    RoomProfileType,
    ConnectionState,
    ErrorCode,
    RTCAutoPlayPolicy
  },
  requestPermission: requestMicrophonePermission
});
