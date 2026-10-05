// Regression tests for the review page's saving and document switching. Run with: node --test tests/
// They load the page's own functions from frontend/index.html into a sandbox with a fake fetch the test controls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf("// Each save sends the document's full set"), html.indexOf('function decide('))
  + html.slice(html.indexOf('// Opening a document waits'), html.indexOf('async function upload('));

function sandbox() {
  const puts = [], gets = [], elements = {};
  const ctx = {
    doc: { id: 'A' }, decisions: {}, cleanText: '', view: 'markup', messages: [], changes: [], cur: 0, pollTimer: null,
    location: { hash: 'A' }, addEventListener: () => {}, clearTimeout: () => {},
    renderText: () => {}, renderShell: () => {}, renderAll: () => {}, renderTally: () => {}, stateOf: () => 'pending',
    $: sel => elements[sel] || (elements[sel] = { options: [], value: '' }),
    toast: m => ctx.messages.push(m),
    fetch: (url, options) => new Promise(resolve => options?.method === 'PUT'
      ? puts.push({ url, body: JSON.parse(options.body), resolve })
      : gets.push({ url, resolve })),
  };
  vm.createContext(ctx);
  vm.runInContext(code + ';this.save = save; this.chain = () => saveChain; this.openDocument = openDocument;', ctx);
  const ok = text => ({ ok: true, json: async () => ({ clean_text: text }) });
  const tick = () => new Promise(r => setImmediate(r));
  const ready = id => ({ ok: true, json: async () => ({ id, state: 'ready', review: { changes: [] }, decisions: {}, clean_text: id }) });
  return { ctx, puts, gets, ok, ready, tick, elements };
}

test('waiting on the save chain covers a save that is still in flight', async () => {
  const { ctx, puts, ok, tick } = sandbox();
  ctx.decisions = { c1: { state: 'accepted' } };
  ctx.save();
  let done = false;
  ctx.chain().then(() => { done = true; });   // what export and document switching await
  await tick();
  assert.equal(done, false, 'must not finish while the PUT is unresolved');
  puts[0].resolve(ok('accepted text'));
  assert.equal(await ctx.chain(), true);
  assert.equal(ctx.cleanText, 'accepted text');
});

test('saves run in order, so the latest decision wins', async () => {
  const { ctx, puts, ok, tick } = sandbox();
  ctx.decisions = { c1: { state: 'accepted' } }; ctx.save();
  ctx.decisions = { c1: { state: 'rejected' } }; ctx.save();
  await tick();
  assert.equal(puts.length, 1, 'the second save waits for the first');
  puts[0].resolve(ok('accepted version')); await tick();
  assert.deepEqual(puts[1].body, { c1: { state: 'rejected' } });
  puts[1].resolve(ok('rejected version'));
  await ctx.chain();
  assert.equal(ctx.cleanText, 'rejected version');
});

test('each save goes to the document it was made in', async () => {
  const { ctx, puts, ok, tick } = sandbox();
  ctx.decisions = { c1: { state: 'accepted' } }; ctx.save();
  ctx.doc = { id: 'B' }; ctx.decisions = {};   // switch documents before the save is sent
  await tick();
  assert.equal(puts[0].url, '/documents/A/decisions');
  assert.deepEqual(puts[0].body, { c1: { state: 'accepted' } });
  puts[0].resolve(ok('A text')); await ctx.chain();
  assert.equal(ctx.cleanText, '', "A's response doesn't overwrite B's clean text");
});

test('a failed save is reported, so the page can stay on the document', async () => {
  const { ctx, puts, tick } = sandbox();
  ctx.decisions = { c1: { state: 'accepted' } }; ctx.save();
  await tick();
  puts[0].resolve({ ok: false, status: 500 });
  assert.equal(await ctx.chain(), false);
  assert.equal(ctx.messages.length, 1);
});

test('switching documents waits for saves made during the switch, and stays put if one fails', async () => {
  const { ctx, puts, gets, ok, tick, elements } = sandbox();
  ctx.decisions = { c1: { state: 'accepted' } }; ctx.save();
  const switching = ctx.openDocument('B');
  await tick();
  assert.equal(elements['#work'].inert, true, 'the review screen is frozen while switching');
  ctx.decisions = { c1: { state: 'rejected' } }; ctx.save();   // a decision made during the wait
  puts[0].resolve(ok('accepted')); await tick();
  puts[1].resolve({ ok: false, status: 500 });
  await switching;
  assert.equal(gets.length, 0, 'B is never fetched');
  assert.equal(ctx.doc.id, 'A');
  assert.deepEqual(ctx.decisions, { c1: { state: 'rejected' } }, "A's latest decision is still in the page to retry");
  assert.equal(elements['#work'].inert, false);
});

test('the last document picked wins, even if an earlier one loads later', async () => {
  const { ctx, gets, ready, tick } = sandbox();
  const toB = ctx.openDocument('B');
  await tick();                                   // B's request is in flight
  const toC = ctx.openDocument('C');
  await tick();
  assert.deepEqual(gets.map(g => g.url), ['/documents/B', '/documents/C']);
  gets[1].resolve(ready('C')); await toC;
  gets[0].resolve(ready('B')); await toB;         // B answers last
  assert.equal(ctx.doc.id, 'C');
  assert.equal(ctx.location.hash, 'C');
});

test('a selection made while saves are pending skips the older one entirely', async () => {
  const { ctx, gets, ready, tick } = sandbox();
  const toB = ctx.openDocument('B'), toC = ctx.openDocument('C');
  await tick();
  assert.deepEqual(gets.map(g => g.url), ['/documents/C']);
  gets[0].resolve(ready('C')); await Promise.all([toB, toC]);
  assert.equal(ctx.doc.id, 'C');
});
