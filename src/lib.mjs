export const TYPES = Object.freeze({
  book: '书籍', video: '影视', music: '音乐', game: '游戏',
  museum: '博物馆', exhibition: '展览', performance: '演出',
});
export const STATUSES = Object.freeze({
  planned: '想体验', in_progress: '进行中', completed: '已完成',
  paused: '已暂停', abandoned: '已放弃',
});
export const REQUIRED_FIELDS = ['id', 'title', 'type', 'history', 'rating', 'comment', 'tags', 'url', 'review_url'];

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}(-\d{2})?(-\d{2})?$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || (month !== undefined && (month < 1 || month > 12))) return false;
  if (day === undefined) return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function validDate(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || !value.trim()) return false;
  // 以 YYYY 或 YYYY- 开头的日期仍校验日历，避免把日期笔误当作自定义时期。
  if (/^\d{4}(?:-|$)/.test(value)) return isCalendarDate(value);
  return true;
}

export function validUrl(value) {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

export function validateRecords(records) {
  const errors = [];
  if (!Array.isArray(records)) return ['主数据必须是一个 JSON 数组。'];
  const ids = new Set();
  records.forEach((record, index) => {
    const at = `第 ${index + 1} 条`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${at}：记录必须是对象。`); return;
    }
    for (const key of REQUIRED_FIELDS) {
      if (!Object.hasOwn(record, key)) errors.push(`${at}：缺少 ${key}。`);
    }
    if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(record.id)) errors.push(`${at}：id 需为小写字母、数字、短横线或下划线。`);
    if (ids.has(record.id)) errors.push(`${at}：id 重复：${record.id}。`);
    ids.add(record.id);
    if (typeof record.title !== 'string' || !record.title.trim()) errors.push(`${at}：title 不能为空。`);
    if (!Object.hasOwn(TYPES, record.type)) errors.push(`${at}：不支持的 type：${record.type}。`);
    for (const key of ['status', 'date']) {
      if (Object.hasOwn(record, key)) errors.push(`${at}：不再支持顶层 ${key}，请放入 history 事件。`);
    }
    if (!Array.isArray(record.history) || record.history.length === 0) {
      errors.push(`${at}：history 必须是至少包含一项事件的数组。`);
    } else {
      record.history.forEach((event, eventIndex) => {
        const eventAt = `${at} history 第 ${eventIndex + 1} 项`;
        if (!event || typeof event !== 'object' || Array.isArray(event)) {
          errors.push(`${eventAt}：事件必须是对象。`); return;
        }
        for (const key of ['status', 'date']) {
          if (!Object.hasOwn(event, key)) errors.push(`${eventAt}：缺少 ${key}。`);
        }
        if (!Object.hasOwn(STATUSES, event.status)) errors.push(`${eventAt}：不支持的 status：${event.status}。`);
        if (!validDate(event.date)) errors.push(`${eventAt}：date 需为有效日期、自定义时期文本或 null；标准日期不能是无效日历日期。`);
      });
    }
    if (record.rating !== null && (typeof record.rating !== 'number' || !Number.isFinite(record.rating) || record.rating < 0 || record.rating > 5)) errors.push(`${at}：rating 需为 0–5 的数字或 null。`);
    if (typeof record.comment !== 'string') errors.push(`${at}：comment 必须是字符串。`);
    if (!Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string' || !tag.trim()) || new Set(record.tags).size !== record.tags.length) errors.push(`${at}：tags 需为无重复、非空字符串的数组。`);
    if (!Array.isArray(record.url) || record.url.some(url => !url || !validUrl(url))) errors.push(`${at}：url 需为完整 http(s) 链接的数组，没有链接用 []。`);
    if (!validUrl(record.review_url)) errors.push(`${at}：review_url 需为 http(s) 链接或空字符串。`);
    if (Object.hasOwn(record, 'demo') && typeof record.demo !== 'boolean') errors.push(`${at}：demo 必须是布尔值。`);
    if ((record.id?.startsWith?.('demo-') || record.tags?.includes?.('虚构示例')) && record.demo !== true) errors.push(`${at}：示例记录必须保留 demo: true。`);
  });
  const demoCount = records.filter(record => record?.demo === true).length;
  if (demoCount > 0 && demoCount !== records.length) errors.push('虚构示例与正式记录不能混用。请先清空示例，再添加正式记录。');
  return errors;
}

export function currentStatus(record) {
  return record.history.at(-1).status;
}
export function lastCompletedDate(record) {
  // 数组顺序就是实际发生顺序；不按日期排序，也不跳过未知的完成日期。
  for (let index = record.history.length - 1; index >= 0; index--) {
    if (record.history[index].status === 'completed') return record.history[index].date || null;
  }
  return null;
}
export function recordYear(record) {
  const date = lastCompletedDate(record);
  if (!date) return 'unknown';
  return isCalendarDate(date) ? date.slice(0, 4) : 'custom';
}
export function yearsOf(records) {
  return [...new Set(records.map(recordYear).filter(year => /^\d{4}$/.test(year)))].sort().reverse();
}
export function filterRecords(records, { query = '', type = '', status = '', year = '' } = {}) {
  return records.filter(record => matchesRecord(record, { query, type, status, year }));
}
export function matchesRecord(record, { query = '', type = '', status = '', year = '' } = {}) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searchable = [record.title, record.comment, lastCompletedDate(record) || '', ...record.tags].join(' ').toLocaleLowerCase();
  return (!type || record.type === type) && (!status || currentStatus(record) === status)
    && (!year || recordYear(record) === year) && words.every(word => searchable.includes(word));
}
export function sortRecords(records) {
  // 明确日期倒序；自定义时期不猜测年代，按 id 稳定排列；空日期最后。
  const group = record => isCalendarDate(lastCompletedDate(record)) ? 0 : lastCompletedDate(record) ? 1 : 2;
  return [...records].sort((a, b) => group(a) - group(b)
    || (group(a) === 0 ? lastCompletedDate(b).localeCompare(lastCompletedDate(a)) : 0) || a.id.localeCompare(b.id));
}
