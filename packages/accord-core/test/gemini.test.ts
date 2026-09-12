import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAIModel, loadModelConfig } from '../src/index.js';
import { OWNER, message, interpretation, testPrivacy, fixedClock, silentLogger } from './harness.js';

test('Google selection requires its own key and never falls back to OpenAI', () => {
  assert.throws(() => loadModelConfig({ ACCORD_MODEL: 'gemini-3.5-flash', OPENAI_API_KEY: 'unused' }), /GOOGLE_API_KEY/);
  assert.equal(loadModelConfig({ ACCORD_MODEL: 'gemini-3.5-flash', GOOGLE_API_KEY: 'test-key' }).provider, 'google');
  assert.equal(loadModelConfig({ ACCORD_MODEL_PROVIDER: 'openai', ACCORD_MODEL: 'test', OPENAI_API_KEY: 'test-key' }).provider, 'openai');
  assert.throws(() => loadModelConfig({ ACCORD_MODEL_PROVIDER: 'unknown' }), /must be/);
});

test('Gemini sends structured chat completions and validates the returned interpretation', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, 'gemini-3.5-flash');
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.messages[1].role, 'user');
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(interpretation()) } }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const model = createOpenAIModel({ provider: 'google', apiKey: 'test-key', model: 'gemini-3.5-flash' }, { privacy: testPrivacy(), clock: fixedClock(), logger: silentLogger() });
    const result = await model.interpret({ messages: [message('Keep existing records 90 days', OWNER)], current: null, ownerId: OWNER, contextRevision: 1 });
    assert.equal(result.disposition, interpretation().disposition);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
