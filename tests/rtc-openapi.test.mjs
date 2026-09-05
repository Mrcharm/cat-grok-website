import test from 'node:test';
import assert from 'node:assert/strict';
import { createRtcOpenApi } from '../server/rtc-openapi.mjs';

const config = {
  rtc: { appId: 'rtc-app-id-placeholder' },
  iam: {
    accessKeyId: 'iam-access-key-id-placeholder',
    secretAccessKey: 'iam-secret-access-key-placeholder'
  },
  s2s: {
    appId: 's2s-app-id-placeholder',
    accessToken: 's2s-access-token-placeholder'
  }
};

const session = {
  roomId: 'room-for-test',
  taskId: 'task-for-test',
  userId: 'user-for-test',
  botUserId: 'jarvis-bot-for-test'
};

class CapturingSigner {
  static calls = [];

  constructor(request, serviceName) {
    this.request = request;
    this.serviceName = serviceName;
    CapturingSigner.calls.push(this);
  }

  addAuthorization(credentials) {
    this.credentials = credentials;
    this.request.headers.Authorization = 'test-signature';
  }
}

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
  json: async () => payload
});

const textResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body
});

test('startVoiceChat signs the O2.0 POST with the required query and body', async () => {
  CapturingSigner.calls = [];
  const requests = [];
  const api = createRtcOpenApi({
    config,
    SignerClass: CapturingSigner,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse(200, { Result: 'ok' });
    }
  });

  await api.startVoiceChat(session);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://rtc.volcengineapi.com');
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
    Action: 'StartVoiceChat',
    Version: '2025-06-01'
  });
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.headers.Authorization, 'test-signature');

  assert.equal(CapturingSigner.calls.length, 1);
  assert.equal(CapturingSigner.calls[0].serviceName, 'rtc');
  assert.equal(CapturingSigner.calls[0].request.region, 'cn-north-1');
  assert.deepEqual(CapturingSigner.calls[0].credentials, {
    accessKeyId: 'iam-access-key-id-placeholder',
    secretKey: 'iam-secret-access-key-placeholder'
  });

  assert.deepEqual(JSON.parse(requests[0].init.body), {
    AppId: 'rtc-app-id-placeholder',
    RoomId: 'room-for-test',
    TaskId: 'task-for-test',
    Config: {
      S2SConfig: {
        Provider: 'volcano',
        OutputMode: 0,
        ProviderParams: {
          app: {
            appid: 's2s-app-id-placeholder',
            token: 's2s-access-token-placeholder'
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
      TargetUserId: ['user-for-test'],
      UserId: 'jarvis-bot-for-test'
    }
  });
});

test('stopVoiceChat signs a minimal task identifier body', async () => {
  CapturingSigner.calls = [];
  const requests = [];
  const api = createRtcOpenApi({
    config,
    SignerClass: CapturingSigner,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse(200, { Result: 'ok' });
    }
  });

  await api.stopVoiceChat(session);

  const requestUrl = new URL(requests[0].url);
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
    Action: 'StopVoiceChat',
    Version: '2025-06-01'
  });
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    AppId: 'rtc-app-id-placeholder',
    RoomId: 'room-for-test',
    TaskId: 'task-for-test'
  });
  assert.equal(CapturingSigner.calls[0].serviceName, 'rtc');
});

test('permission and quota failures expose stable safe codes only', async () => {
  for (const [status, payload, expectedCode] of [
    [403, { ResponseMetadata: { Error: { Code: 'AccessDenied' } } }, 'RTC_PERMISSION'],
    [429, { ResponseMetadata: { Error: { Code: 'RequestLimitExceeded' } } }, 'RTC_QUOTA']
  ]) {
    const api = createRtcOpenApi({
      config,
      SignerClass: CapturingSigner,
      fetchImpl: async () => jsonResponse(status, payload)
    });

    await assert.rejects(
      () => api.startVoiceChat(session),
      error => error.code === expectedCode
        && !error.message.includes('test-signature')
        && !error.message.includes('AccessDenied')
        && !error.message.includes('RequestLimitExceeded')
    );
  }
});

test('non-JSON permission and quota responses keep their HTTP failure classes', async () => {
  for (const [status, expectedCode] of [
    [403, 'RTC_PERMISSION'],
    [429, 'RTC_QUOTA']
  ]) {
    const api = createRtcOpenApi({
      config,
      SignerClass: CapturingSigner,
      fetchImpl: async () => textResponse(status, '<html>upstream error</html>')
    });

    await assert.rejects(
      () => api.startVoiceChat(session),
      error => error.code === expectedCode
    );
  }
});

test('a successful response with invalid JSON text becomes RTC_UPSTREAM without calling json', async () => {
  let textCalls = 0;
  let jsonCalls = 0;
  const api = createRtcOpenApi({
    config,
    SignerClass: CapturingSigner,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => {
        textCalls += 1;
        return '<html>unexpected success page</html>';
      },
      json: async () => {
        jsonCalls += 1;
        return { Result: 'must not be trusted' };
      }
    })
  });

  await assert.rejects(
    () => api.startVoiceChat(session),
    error => error.code === 'RTC_UPSTREAM'
  );
  assert.equal(textCalls, 1);
  assert.equal(jsonCalls, 0);
});

test('public errors do not expose credential, body, signed-header, or upstream sentinels', async () => {
  const sentinels = [
    'SENTINEL_IAM_ACCESS_ID_DO_NOT_LEAK',
    'SENTINEL_IAM_SECRET_DO_NOT_LEAK',
    'SENTINEL_S2S_TOKEN_DO_NOT_LEAK',
    'SENTINEL_SERIALIZED_BODY_DO_NOT_LEAK',
    'SENTINEL_UPSTREAM_RAW_MESSAGE_DO_NOT_LEAK',
    'SENTINEL_SIGNED_HEADER_DO_NOT_LEAK'
  ];
  const sensitiveConfig = {
    rtc: { appId: 'rtc-app-id-placeholder' },
    iam: {
      accessKeyId: sentinels[0],
      secretAccessKey: sentinels[1]
    },
    s2s: {
      appId: 's2s-app-id-placeholder',
      accessToken: sentinels[2]
    }
  };
  const sensitiveSession = { ...session, userId: sentinels[3] };
  class SentinelSigner {
    constructor(request) { this.request = request; }
    addAuthorization(credentials) {
      this.request.headers.Authorization = `${sentinels[5]}:${credentials.secretKey}`;
    }
  }
  const api = createRtcOpenApi({
    config: sensitiveConfig,
    SignerClass: SentinelSigner,
    fetchImpl: async () => jsonResponse(403, {
      ResponseMetadata: {
        Error: {
          Code: 'AccessDenied',
          Message: sentinels[4]
        }
      }
    })
  });

  await assert.rejects(
    () => api.startVoiceChat(sensitiveSession),
    error => {
      const publicError = `${error.code}\n${error.message}\n${JSON.stringify(error)}`;
      return error.code === 'RTC_PERMISSION'
        && sentinels.every(sentinel => !publicError.includes(sentinel));
    }
  );
});

test('the installed Signer signs a no-network request without printing its value', async () => {
  let authorization;
  const api = createRtcOpenApi({
    config,
    fetchImpl: async (_url, init) => {
      authorization = init.headers.Authorization;
      return jsonResponse(200, { Result: 'ok' });
    }
  });

  await api.startVoiceChat(session);

  assert.equal(typeof authorization, 'string');
  assert.ok(authorization.length > 0);
});

test('network and unclassified failures become RTC_UPSTREAM without raw details', async () => {
  const api = createRtcOpenApi({
    config,
    SignerClass: CapturingSigner,
    fetchImpl: async () => {
      throw new Error('request body and signed headers must not escape');
    }
  });

  await assert.rejects(
    () => api.startVoiceChat(session),
    error => error.code === 'RTC_UPSTREAM'
      && !error.message.includes('request body')
      && !error.message.includes('signed headers')
  );
});
