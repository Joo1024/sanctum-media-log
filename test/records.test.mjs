import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, STATUSES, validateRecords, validDate, isCalendarDate, currentStatus, lastCompletedDate, recordYear, yearsOf, filterRecords, sortRecords } from '../src/lib.mjs';

const event = (status = 'completed', date = '2026-10-31') => ({ status, date });
const entry = (changes = {}) => ({ id: 'record-1', title: '测试作品', type: 'book', history: [event()], rating: null, comment: '', tags: [], url: [], review_url: '', ...changes });
const dated = (date, changes = {}) => entry({ history: [event('completed', date)], ...changes });

test('允许空数据、部分日期、未评分、额外字段和同一对象的多次体验', () => {
  assert.deepEqual(validateRecords([]), []);
  const record = entry({ platform: '纸书', history: [event('completed', '中学时代'), event('in_progress', '2026-10'), event('completed', '2026-11'), event('completed', null)] });
  assert.deepEqual(validateRecords([record]), []);
  assert.deepEqual(validateRecords([dated('2025', { rating: 0 })]), []);
  assert.deepEqual(validateRecords([dated('2026-02', { rating: 4.5 })]), []);
  assert.equal(currentStatus(record), 'completed');
  assert.equal(lastCompletedDate(record), null);
});

test('拒绝旧顶层字段、空历史、非对象事件、缺少事件字段和非法状态', () => {
  for (const history of [undefined, null, {}, [], [null], [[]], ['completed'], [{}], [{ status: 'completed' }], [{ date: null }], [event('invalid')], [event('planned'), event('invalid')]]) {
    assert.ok(validateRecords([entry({ history })]).length, JSON.stringify(history));
  }
  const missing = entry(); delete missing.history;
  assert.ok(validateRecords([missing]).some(error => error.includes('缺少 history')));
  for (const key of ['status', 'date']) assert.ok(validateRecords([entry({ [key]: null })]).some(error => error.includes(`顶层 ${key}`)));
  for (const status of Object.keys(STATUSES)) assert.deepEqual(validateRecords([entry({ history: [event(status, null)] })]), []);
});

test('每项事件均校验日期；拒绝重复标识、非法评分和链接', () => {
  for (const date of ['2025-02-29', '2026-04-31', '2026-13', '2026-00', '2026-01-00', '0000', '2026-1', '2026-01-01T00:00:00', 2026, '   ']) {
    assert.equal(validDate(date), false, String(date));
    assert.ok(validateRecords([entry({ history: [event('planned', date), event()] })]).some(error => error.includes('history 第 1 项')));
  }
  for (const date of ['2024-02-29', '2000-02-29', '中学时代', '2026年暑假', null, '']) assert.equal(validDate(date), true);
  assert.equal(validDate('1900-02-29'), false);
  assert.ok(validateRecords([entry(), entry()]).some(error => error.includes('id 重复')));
  for (const changes of [{ rating: 6 }, { rating: '4' }, { url: ['javascript:alert(1)'] }, { url: '' }, { url: null }, { url: [''] }, { url: ['https://example.com', 123] }, { review_url: '/blog' }, { tags: ['重复', '重复'] }, { type: 'invalid' }]) assert.ok(validateRecords([entry(changes)]).length);
});

test('当前状态取末项，最近完成日期取最后的 completed，而不是日期最大值或当前事件日期', () => {
  const history = [event('completed', '2026-11'), event('completed', '中学时代'), event('in_progress', '2027-01'), event('paused', '2027-02')];
  const record = entry({ history });
  const snapshot = structuredClone(record);
  assert.equal(currentStatus(record), 'paused');
  assert.equal(lastCompletedDate(record), '中学时代');
  assert.equal(recordYear(record), 'custom');
  assert.equal(filterRecords([record], { status: 'paused', year: 'custom' }).length, 1);
  assert.equal(filterRecords([record], { status: 'completed' }).length, 0);
  assert.equal(filterRecords([record], { year: '2026' }).length, 0);
  assert.equal(filterRecords([record], { query: '2027-02' }).length, 0);
  assert.deepEqual(record, snapshot);
});

test('没有完成事件或最后完成日期未知，均不使用其他事件的日期或更早完成日期', () => {
  for (const history of [[event('in_progress', '2026-10')], [event('planned', '中学时代')], [event(), event('completed', null), event('abandoned', '2027')], [event(), event('completed', '')]]) {
    const record = entry({ history });
    assert.equal(lastCompletedDate(record), null);
    assert.equal(recordYear(record), 'unknown');
    assert.deepEqual(yearsOf([record]), []);
    assert.equal(filterRecords([record], { year: 'unknown' }).length, 1);
  }
});

test('示例不能与正式记录混用；删除标识不能把示例误当正式记录', () => {
  const demo = entry({ id: 'demo-1', demo: true });
  assert.deepEqual(validateRecords([demo]), []);
  assert.ok(validateRecords([demo, entry()]).some(error => error.includes('不能混用')));
  assert.ok(validateRecords([entry({ id: 'demo-1' })]).length);
});

test('组合名称、短评、标签、类型、当前状态与最近完成年份筛选', () => {
  const records = [entry({ title: '海边 ABC', comment: '慢慢读', tags: ['旅行'], history: [event('completed', '2025'), event(), event('in_progress', '2027')] }), entry({ id: 'record-2', type: 'movie', history: [event('planned', null)] }), dated('2025', { id: 'record-3' })];
  assert.equal(filterRecords(records, { query: 'abc 旅行', type: 'book', status: 'in_progress', year: '2026' }).length, 1);
  assert.equal(filterRecords(records, { query: '慢慢读' }).length, 1);
  assert.equal(filterRecords(records, { type: 'movie', year: '2026' }).length, 0);
  assert.equal(filterRecords(records, { year: 'unknown' })[0].id, 'record-2');
  for (const type of Object.keys(TYPES)) assert.equal(filterRecords([entry({ type })], { type }).length, 1);
  for (const status of Object.keys(STATUSES)) assert.equal(filterRecords([entry({ history: [event(status, null)] })], { status }).length, 1);
});

test('按最近完成日期排序，保留日期精度，自定义时期与未知日期置后', () => {
  const records = [dated(null, { id: 'unknown' }), dated('2026', { id: 'year' }), dated('2026-10', { id: 'month' }), entry({ id: 'day', history: [event(), event('in_progress', '2027')] }), entry({ id: 'planned', history: [event('planned', '2028')] })];
  assert.deepEqual(sortRecords(records).map(record => record.id), ['day', 'month', 'year', 'planned', 'unknown']);
  assert.equal(filterRecords(records, { year: '2026', status: 'completed' }).length, 2);
  assert.equal(filterRecords(records, { year: 'unknown', status: 'completed' }).length, 1);
  assert.equal(records[1].history[0].date, '2026');
});

test('空数据与搜索无结果返回空数组', () => {
  assert.deepEqual(filterRecords([], { query: '书' }), []);
  assert.deepEqual(yearsOf([]), []);
  assert.deepEqual(sortRecords([]), []);
  assert.deepEqual(filterRecords([entry()], { query: '没有这本书' }), []);
});

test('来源链接保留空数组和多个 HTTP(S) 链接，长评仍是单个链接', () => {
  assert.deepEqual(validateRecords([entry({ url: [] })]), []);
  assert.deepEqual(validateRecords([entry({ url: ['https://example.com/a', 'https://example.org/b'], review_url: 'https://example.com/review' })]), []);
  assert.ok(validateRecords([entry({ review_url: [] })]).length);
});

test('最近完成的自定义时期原样保留，可搜索并与标准年份、未知日期分组筛选', () => {
  const records = [dated('中学时代', { id: 'school' }), dated('2026年暑假', { id: 'summer' }), dated('2026', { id: 'year' }), dated(null, { id: 'unknown' })];
  assert.deepEqual(validateRecords(records), []);
  assert.equal(isCalendarDate('中学时代'), false);
  assert.equal(recordYear(records[0]), 'custom');
  assert.equal(recordYear(records[1]), 'custom');
  assert.deepEqual(yearsOf(records), ['2026']);
  assert.deepEqual(filterRecords(records, { year: 'custom' }).map(record => record.id), ['school', 'summer']);
  assert.deepEqual(filterRecords(records, { query: '中学时代' }).map(record => record.id), ['school']);
  assert.deepEqual(filterRecords(records, { year: '2026' }).map(record => record.id), ['year']);
  assert.deepEqual(filterRecords(records, { year: 'unknown' }).map(record => record.id), ['unknown']);
  assert.deepEqual(sortRecords(records).map(record => record.id), ['year', 'school', 'summer', 'unknown']);
  assert.equal(records[0].history[0].date, '中学时代');
});
