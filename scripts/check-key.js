// Checks your API key and shows which model to use. The key is never printed.
import { llmConfig, listModels, pickModel, extractProfile } from '../lib/llm.js';

try {
  const cfg = llmConfig();
  console.log('Provider detected:', cfg.provider);
  let ids = [];
  try { ids = await listModels(cfg); console.log(`Models available (${ids.length}):\n  ${ids.join('\n  ')}`); }
  catch (e) { console.log('Could not list models:', e.detail); }
  const model = cfg.model || pickModel(cfg.provider, ids);
  console.log('\nTesting model:', model);
  process.env.LLM_MODEL = model ?? '';
  const start = Date.now();
  const r = await extractProfile('Asha Rao. Education: B.Tech Computer Science, 2021-08 to 2025-05, CGPA 8.4/10. Skills: Python. Projects: Image classifier with 92% accuracy.');
  console.log(`SUCCESS in ${((Date.now() - start) / 1000).toFixed(1)} s`);
  console.log('Degree field:', r.profile.degreeField, '| Tokens used:', JSON.stringify(r.usage));
  console.log(`\nAdd this line to .env and to Vercel:  LLM_MODEL=${r.model}`);
} catch (e) {
  console.error('FAILED:', e.message, '|', e.detail ?? '');
  process.exit(1);
}
