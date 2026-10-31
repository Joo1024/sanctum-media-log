import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, STATUSES, validateRecords, validDate, isCalendarDate, recordYear, yearsOf, filterRecords, sortRecords } from '../src/lib.mjs';

const entry = (changes = {}) => ({ id: 'record-1', title: '测试作品', type: 'book', status: 'completed', date: '2026-10-31', rating: null, comment: '', tags: [], url: [], review_url: '', ...changes });

test('允许空数据、部分日期和未评分；同一作品可以多次记录', () => {
  assert.deepEqual(validateRecords([]), []);
  assert.deepEqual(validateRecords([entry(), entry({ id: 'record-2', date: '2025', rating: 0 }), entry({ id: 'record-3', date: '2026-02', rating: 4.5 })]), []);
});

test('拒绝无效日历日期、重复标识、非法评分和链接', () => {
  for (const date of ['2025-02-29', '2026-04-31', '2026-13', '2026-00', '2026-01-00', '0000', '2026-1', '2026-01-01T00:00:00', 2026]) assert.equal(validDate(date), false, String(date));
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('1900-02-29'), false);
  assert.equal(validDate('2000-02-29'), true);
  assert.ok(validateRecords([entry(), entry()]).some(error => error.includes('id 重复')));
  for (const changes of [{ rating: 6 }, { rating: '4' }, { url: ['javascript:alert(1)'] }, { url: '' }, { url: null }, { url: [''] }, { url: ['https://example.com', 123] }, { review_url: '/blog' }, { tags: ['重复', '重复'] }, { type: 'invalid' }, { status: 'invalid' }]) assert.ok(validateRecords([entry(changes)]).length);
  const missing = entry(); delete missing.date;
  assert.ok(validateRecords([missing]).some(error => error.includes('缺少 date')));
});

test('示例不能与正式记录混用；删除标识不能把示例误当正式记录', () => {
  const demo = entry({ id: 'demo-1', demo: true });
  assert.deepEqual(validateRecords([demo]), []);
  assert.ok(validateRecords([demo, entry()]).some(error => error.includes('不能混用')));
  assert.ok(validateRecords([entry({ id: 'demo-1' })]).length);
});

test('搜索名称、短评和标签，并组合类型、状态、年份筛选', () => {
  const records = [entry({ title: '海边 ABC', comment: '慢慢读', tags: ['旅行'] }), entry({ id: 'record-2', type: 'movie', status: 'planned', date: null }), entry({ id: 'record-3', date: '2025' })];
  assert.equal(filterRecords(records, { query: 'abc 旅行', type: 'book', status: 'completed', year: '2026' }).length, 1);
  assert.equal(filterRecords(records, { query: '慢慢读' }).length, 1);
  assert.equal(filterRecords(records, { type: 'movie', year: '2026' }).length, 0);
  assert.equal(filterRecords(records, { year: 'unknown' })[0].id, 'record-2');
  for (const type of Object.keys(TYPES)) assert.equal(filterRecords([entry({ type })], { type }).length, 1);
  for (const status of Object.keys(STATUSES)) assert.equal(filterRecords([entry({ status })], { status }).length, 1);
});

test('排序保留日期精度，未知日期置后', () => {
  const records = [entry({ id: 'unknown', date: null }), entry({ id: 'year', date: '2026' }), entry({ id: 'month', date: '2026-10' }), entry({ id: 'day', date: '2026-10-31' }), entry({ id: 'planned', date: null, status: 'planned' })];
  assert.deepEqual(sortRecords(records).map(record => record.id), ['day', 'month', 'year', 'planned', 'unknown']);
  assert.equal(filterRecords(records, { year: '2026', status: 'completed' }).length, 3);
  assert.equal(filterRecords(records, { year: 'unknown', status: 'completed' }).length, 1);
  assert.equal(records[1].date, '2026');
});

test('空数据与搜索无结果返回空数组', () => {
  assert.deepEqual(filterRecords([], { query: '书' }), []);
  assert.deepEqual(filterRecords([entry()], { query: '没有这本书' }), []);
});

test('来源链接支持空数组和多个 HTTP(S) 链接，长评仍是单个链接', () => {
  assert.deepEqual(validateRecords([entry({ url: [] })]), []);
  assert.deepEqual(validateRecords([entry({ url: ['https://example.com/a', 'https://example.org/b'], review_url: 'https://example.com/review' })]), []);
  assert.ok(validateRecords([entry({ review_url: [] })]).length);
});

test('自定义时期原样保留，可搜索并与年份、未知日期分开筛选', () => {
  const records = [entry({ id: 'school', date: '中学时代' }), entry({ id: 'summer', date: '2026年暑假' }), entry({ id: 'year', date: '2026' }), entry({ id: 'unknown', date: null })];
  assert.deepEqual(validateRecords(records), []);
  assert.equal(validDate('   '), false);
  assert.equal(isCalendarDate('中学时代'), false);
  assert.equal(recordYear(records[0]), 'custom');
  assert.equal(recordYear(records[1]), 'custom');
  assert.deepEqual(yearsOf(records), ['2026']);
  assert.deepEqual(filterRecords(records, { year: 'custom' }).map(record => record.id), ['school', 'summer']);
  assert.deepEqual(filterRecords(records, { query: '中学时代' }).map(record => record.id), ['school']);
  assert.deepEqual(filterRecords(records, { year: '2026' }).map(record => record.id), ['year']);
  assert.deepEqual(filterRecords(records, { year: 'unknown' }).map(record => record.id), ['unknown']);
  assert.deepEqual(sortRecords(records).map(record => record.id), ['year', 'school', 'summer', 'unknown']);
  assert.equal(records[0].date, '中学时代');
});
