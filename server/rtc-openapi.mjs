import { Signer as OfficialSigner } from '@volcengine/openapi';

const HOST = 'https://rtc.volcengineapi.com';
const REGION = 'cn-north-1';
const VERSION = '2025-06-01';

const safeError = code => {
  const messages = {
    RTC_PERMISSION: '实时语音服务权限校验失败，请检查服务端配置。',
    RTC_QUOTA: '实时语音服务当前繁忙，请稍后重试。',
    RTC_UPSTREAM: '实时语音服务暂时不可用，请稍后重试。'
  };
  const error = new Error(messages[code]);
  error.code = code;
  return error;
};

const failureCode = (status, payload) => {
  const upstreamCode = String(payload?.ResponseMetadata?.Error?.Code || '');
  if (status === 401 || status === 403 || /access|permission|auth|forbidden/i.test(upstreamCode)) {
    return 'RTC_PERMISSION';
  }
  if (status === 429 || /quota|limit|throttl/i.test(upstreamCode)) {
    return 'RTC_QUOTA';
  }
  return 'RTC_UPSTREAM';
};

const startBody = (config, session) => ({
  AppId: config.rtc.appId,
  RoomId: session.roomId,
  TaskId: session.taskId,
  Config: {
    S2SConfig: {
      Provider: 'volcano',
      OutputMode: 0,
      ProviderParams: {
        app: {
          appid: config.s2s.appId,
          token: config.s2s.accessToken
        },
        dialog: {
          extra: {
            model: '1.2.1.1',
            bot_name: 'JARVIS',
            system_role: '你是 JARVIS，一位可靠的中文语音陪伴助手。',
            speaking_style: '温暖、沉稳、简洁。'
          },
          tts: { speaker: 'zh_male_yunzhou_jupiter_bigtts' }
        }
      }
    },
    SubtitleConfig: { SubtitleMode: 1 }
  },
  AgentConfig: {
    TargetUserId: [session.userId],
    UserId: session.botUserId
  }
});

const stopBody = (config, session) => ({
  AppId: config.rtc.appId,
  RoomId: session.roomId,
  TaskId: session.taskId
});

export function createRtcOpenApi({
  config,
  fetchImpl = globalThis.fetch,
  SignerClass = OfficialSigner,
  deadlineMs = 10000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) throw new RangeError('Invalid RTC deadline');
  const request = async (action, body) => {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeoutFn(() => {
        controller.abort();
        reject(safeError('RTC_UPSTREAM'));
      }, deadlineMs);
    });
    const operation = async () => {
      const signedRequest = {
        region: REGION,
        method: 'POST',
        params: { Action: action, Version: VERSION },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };

      let response;
      try {
        const signer = new SignerClass(signedRequest, 'rtc');
        signer.addAuthorization({
          accessKeyId: config.iam.accessKeyId,
          secretKey: config.iam.secretAccessKey
        });
        const query = new URLSearchParams(signedRequest.params);
        response = await fetchImpl(`${HOST}?${query}`, {
          method: signedRequest.method,
          headers: signedRequest.headers,
          body: signedRequest.body,
          signal: controller.signal
        });
      } catch {
        throw safeError('RTC_UPSTREAM');
      }

      let payload;
      try {
        payload = JSON.parse(await response.text());
      } catch {
        throw safeError(response.ok
          ? 'RTC_UPSTREAM'
          : failureCode(response.status));
      }

      if (!response.ok || payload?.ResponseMetadata?.Error) {
        throw safeError(failureCode(response.status, payload));
      }
      return payload?.Result;
    };
    try {
      // Abort alone cannot bound injected fetches or body readers that ignore it.
      return await Promise.race([operation(), deadline]);
    } finally {
      clearTimeoutFn(timer);
    }
  };

  return {
    startVoiceChat: session => request('StartVoiceChat', startBody(config, session)),
    stopVoiceChat: session => request('StopVoiceChat', stopBody(config, session))
  };
}
