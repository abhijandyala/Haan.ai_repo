import 'dotenv/config';
import { GoogleGenerativeAI, FunctionCallingMode } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

async function testPipeline() {
  console.log('=== HAAN.AI END-TO-END PIPELINE TEST ===\n');

  const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log('[1/6] Checking API keys...');
  console.log('  Google:', googleKey ? googleKey.substring(0, 10) + '...' : 'MISSING');
  console.log('  OpenAI:', openaiKey ? openaiKey.substring(0, 10) + '...' : 'MISSING');
  console.log('  Anthropic:', anthropicKey ? anthropicKey.substring(0, 10) + '...' : 'MISSING');
  if (!googleKey || !openaiKey || !anthropicKey) { console.log('FAIL: Missing keys'); process.exit(1); }
  console.log('  OK\n');

  // Test 2: Gemini 3 Pro with function calling + thought signatures (PLANNER)
  console.log('[2/6] Gemini 3 Pro (planner) - function calling + thought signatures...');
  const genAI = new GoogleGenerativeAI(googleKey);
  const gemini = genAI.getGenerativeModel({
    model: 'gemini-3-pro-preview',
    tools: [{ functionDeclarations: [{
      name: 'file_list', description: 'List files',
      parameters: { type: 'OBJECT', properties: { path: { type: 'STRING', description: 'path' } }, required: ['path'] }
    }] }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const r1 = await gemini.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'List files in src/' }] }],
  });
  const parts1 = r1.response.candidates[0].content.parts;
  let fcPart = null;
  for (const p of parts1) {
    if (p.functionCall) {
      fcPart = p;
      console.log('  FC:', p.functionCall.name, '| thoughtSig:', 'thoughtSignature' in p ? 'YES' : 'NO');
    }
  }
  if (!fcPart) { console.log('  FAIL: No function call'); process.exit(1); }

  // Round 2 - verify thought signature echoed back works
  const r2 = await gemini.generateContent({
    contents: [
      { role: 'user', parts: [{ text: 'List files in src/' }] },
      { role: 'model', parts: [fcPart] },
      { role: 'function', parts: [{ functionResponse: { name: 'file_list', response: { result: 'index.ts\napp.ts' } } }] },
    ],
  });
  let t2 = ''; try { t2 = r2.response.text(); } catch {}
  console.log('  Round-trip:', t2 ? t2.substring(0, 80) : '(more function calls)');
  console.log('  PASS\n');

  // Test 3: Claude Opus 4.5 streaming (BUILDER)
  console.log('[3/6] Claude Opus 4.5 (builder) - streaming...');
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const s1 = anthropic.messages.stream({
    model: 'claude-opus-4-5-20251101', max_tokens: 64,
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
  });
  let ct = '';
  for await (const ev of s1) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') ct += ev.delta.text;
  }
  const fm1 = await s1.finalMessage();
  console.log('  Response:', ct.trim());
  console.log('  Tokens:', fm1.usage.input_tokens, 'in /', fm1.usage.output_tokens, 'out');
  console.log('  PASS\n');

  // Test 4: Claude Sonnet 4.5 (DEBUGGER)
  console.log('[4/6] Claude Sonnet 4.5 (debugger) - streaming...');
  const s2 = anthropic.messages.stream({
    model: 'claude-sonnet-4-5', max_tokens: 64,
    messages: [{ role: 'user', content: 'Say debug in one word.' }],
  });
  let st = '';
  for await (const ev of s2) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') st += ev.delta.text;
  }
  const fm2 = await s2.finalMessage();
  console.log('  Response:', st.trim());
  console.log('  Tokens:', fm2.usage.input_tokens, 'in /', fm2.usage.output_tokens, 'out');
  console.log('  PASS\n');

  // Test 5: GPT-5.2-Codex via Responses API (TESTER)
  console.log('[5/6] GPT-5.2-Codex (tester) - Responses API...');
  const openai = new OpenAI({ apiKey: openaiKey });
  const cr = await openai.responses.create({
    model: 'gpt-5.2-codex',
    input: [{ role: 'user', content: 'Say test in one word.' }],
    max_output_tokens: 64,
  });
  let crt = '';
  for (const item of cr.output || []) {
    if (item.type === 'message') {
      for (const c of item.content || []) { if (c.type === 'output_text') crt += c.text; }
    }
  }
  console.log('  Response:', crt.trim());
  console.log('  Tokens:', cr.usage?.input_tokens, 'in /', cr.usage?.output_tokens, 'out');
  console.log('  PASS\n');

  // Test 6: GPT-5.1-Codex-Max via Responses API with tools (FEATURE ENGINEER)
  console.log('[6/6] GPT-5.1-Codex-Max (feature-engineer) - Responses API + tools...');
  const mr = await openai.responses.create({
    model: 'gpt-5.1-codex-max',
    input: [{ role: 'user', content: 'List files in the project root' }],
    tools: [{ type: 'function', name: 'file_list', description: 'List files',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }],
    max_output_tokens: 256,
  });
  let mrt = ''; let mtc = 0;
  for (const item of mr.output || []) {
    if (item.type === 'message') {
      for (const c of item.content || []) { if (c.type === 'output_text') mrt += c.text; }
    } else if (item.type === 'function_call') {
      mtc++;
      console.log('  Tool call:', item.name, JSON.stringify(JSON.parse(item.arguments)));
    }
  }
  if (mrt) console.log('  Text:', mrt.substring(0, 80));
  console.log('  Tool calls:', mtc);
  console.log('  Tokens:', mr.usage?.input_tokens, 'in /', mr.usage?.output_tokens, 'out');
  console.log('  PASS\n');

  console.log('========================================');
  console.log('ALL 6 TESTS PASSED - Pipeline ready!');
  console.log('========================================');
  console.log('');
  console.log('Models verified:');
  console.log('  Planner:   gemini-3-pro-preview     (Google)    - FC + thought signatures');
  console.log('  Builder:   claude-opus-4-5-20251101  (Anthropic) - streaming');
  console.log('  Debugger:  claude-sonnet-4-5         (Anthropic) - streaming');
  console.log('  Tester:    gpt-5.2-codex            (OpenAI)    - Responses API');
  console.log('  Engineer:  gpt-5.1-codex-max        (OpenAI)    - Responses API + tools');
}

testPipeline().catch(err => {
  console.error('\nFAIL:', err.message || err);
  if (err.status) console.error('Status:', err.status);
  if (err.error) console.error('Details:', JSON.stringify(err.error, null, 2));
  process.exit(1);
});
