import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { adminPageResponse, loginPageResponse } from '../worker/lib/admin-page.js';
import { ADMIN_CLIENT, I18N_RUNTIME } from '../worker/lib/admin/client.js';
import {
  LANGUAGES,
  LOGIN_KEYS,
  MESSAGES,
  formatMessage,
  pickLanguage,
  pickMessages,
  translator
} from '../worker/lib/admin/i18n.js';

const [ZH, EN] = LANGUAGES;

test('both languages have exactly the same keys with non-empty text', () => {
  assert.deepEqual(LANGUAGES, ['zh-TW', 'en']);
  const zhKeys = Object.keys(MESSAGES[ZH]).sort();
  assert.deepEqual(Object.keys(MESSAGES[EN]).sort(), zhKeys);
  assert.ok(zhKeys.length > 100);
  for (const lang of LANGUAGES) {
    for (const [key, value] of Object.entries(MESSAGES[lang])) {
      assert.equal(typeof value, 'string', `${lang} ${key}`);
      assert.ok(value.trim() !== '', `${lang} ${key} is empty`);
    }
  }
});

test('placeholders match between the two languages', () => {
  const vars = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(MESSAGES[ZH])) {
    assert.deepEqual(vars(MESSAGES[EN][key]), vars(MESSAGES[ZH][key]), key);
  }
});

test('no English text is still an untranslated TODO placeholder', () => {
  const todo = Object.entries(MESSAGES[EN]).filter(([, value]) => value.startsWith('TODO:'));
  assert.deepEqual(todo.map(([key]) => key), []);
});

test('pickLanguage follows the first Accept-Language entry', () => {
  assert.equal(pickLanguage('zh-TW,zh;q=0.9,en;q=0.8'), 'zh-TW');
  assert.equal(pickLanguage('zh-CN'), 'zh-TW');
  assert.equal(pickLanguage('ZH'), 'zh-TW');
  assert.equal(pickLanguage('en-US,zh-TW;q=0.5'), 'en');
  assert.equal(pickLanguage('ja'), 'en');
  assert.equal(pickLanguage(''), 'en');
  assert.equal(pickLanguage(null), 'en');
  assert.equal(pickLanguage('*'), 'en');
});

test('formatMessage replaces only the variables it is given', () => {
  assert.equal(formatMessage('{n} days', { n: 3 }), '3 days');
  assert.equal(formatMessage('Used by {range}', { n: 1 }), 'Used by {range}');
  assert.equal(formatMessage('Used by {range}'), 'Used by {range}');
  assert.equal(formatMessage('{a}{a}', { a: 0 }), '00');
  assert.equal(formatMessage('', { a: 1 }), '');
});

test('translator falls back to zh-TW, then to the key', () => {
  assert.equal(translator('en')('login.submit'), 'Sign in');
  assert.equal(translator('zh-TW')('login.submit'), '登入');
  assert.equal(translator('fr')('login.submit'), 'Sign in');
  assert.equal(translator('en')('missing.key'), 'missing.key');
  assert.equal(translator('en')('unit.days', { n: 5 }), '5 days');
});

test('the login page only ships its own keys', () => {
  const picked = pickMessages(LOGIN_KEYS);
  for (const lang of LANGUAGES) {
    assert.deepEqual(Object.keys(picked[lang]).sort(), [...LOGIN_KEYS].sort());
    for (const key of LOGIN_KEYS) assert.ok(MESSAGES[lang][key], `${lang} ${key}`);
  }
});

test('the page scripts parse', () => {
  assert.doesNotThrow(() => new vm.Script(`const BOOT = {};${I18N_RUNTIME}${ADMIN_CLIENT}`));
});

test('every key the markup and script use exists', async () => {
  const html = (await adminPageResponse('zh-TW').text()) + (await loginPageResponse(401, true, 'en').text());
  const used = new Set();
  for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(match[1]);
  for (const match of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of match[1].split(';')) used.add(pair.split(':')[1]);
  }
  // String literals in the page script that look like keys of a known group, e.g.
  // t('save.clean'), row('status.authLeft', …), confirm keys and ternaries.
  const groups = new Set(Object.keys(MESSAGES[ZH]).map((key) => key.split('.')[0]));
  for (const match of ADMIN_CLIENT.matchAll(/'([a-z]+)\.([\w.]*\w)'/gi)) {
    if (groups.has(match[1])) used.add(`${match[1]}.${match[2]}`);
  }
  // Keys the script builds from a field name.
  for (const name of ['username', 'topHeroTitle', 'mainTitle', 'lastUpdatedPrefix']) used.add(`field.${name}`);
  assert.ok(used.size > 80);
  for (const key of used) {
    for (const lang of LANGUAGES) assert.ok(Object.hasOwn(MESSAGES[lang], key), `${lang} is missing ${key}`);
  }
});
