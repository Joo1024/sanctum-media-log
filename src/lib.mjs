export const TYPES = Object.freeze({
  book: '书籍', video: '影视', music: '音乐', game: '游戏',
  museum: '博物馆', exhibition: '展览', performance: '演出',
});
export const STATUSES = Object.freeze({
  planned: '计划中', in_progress: '进行中', completed: '已完成',
  paused: '已暂停', abandoned: '已放弃',
});
export const REQUIRED_FIELDS = ['id', 'title', 'type', 'history', 'comment', 'tags', 'url', 'review_url'];

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

function validRating(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5);
}
function validStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
}
function validateOptionalFields(value, at, errors) {
  if (Object.hasOwn(value, 'rating') && !validRating(value.rating)) errors.push(`${at}：rating 需为 0–5 的数字或 null。`);
  if (Object.hasOwn(value, 'progress')) {
    const progress = value.progress;
    const amount = number => typeof number === 'number' && Number.isFinite(number) && number >= 0;
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)
      || !amount(progress.value)
      || (Object.hasOwn(progress, 'total') && !amount(progress.total))
      || (Object.hasOwn(progress, 'unit') && typeof progress.unit !== 'string')) {
      errors.push(`${at}：progress 需为对象，value 和可选 total 为非负有限数字，可选 unit 为字符串。`);
    }
  }
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
        validateOptionalFields(event, eventAt, errors);
        if (Object.hasOwn(event, 'comment') && typeof event.comment !== 'string') errors.push(`${eventAt}：comment 必须是字符串。`);
        if (!validDate(event.date)) errors.push(`${eventAt}：date 需为有效日期、自定义时期文本或 null；标准日期不能是无效日历日期。`);
      });
    }
    validateOptionalFields(record, at, errors);
    for (const key of ['author', 'lists']) {
      if (Object.hasOwn(record, key) && !validStringArray(record[key])) errors.push(`${at}：${key} 需为非空字符串的数组，没有内容用 []。`);
    }
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
export function latestUpdateDate(record) {
  return record.history.at(-1).date || null;
}
export function currentRating(record) {
  for (let index = record.history.length - 1; index >= 0; index--) {
    if (record.history[index].rating != null) return record.history[index].rating;
  }
  // 兼容只在顶层保存评分的旧记录，新评分只需写入 history。
  return record.rating ?? null;
}
export function recordYear(record) {
  const date = latestUpdateDate(record);
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
  const searchable = [record.title, record.comment, latestUpdateDate(record) || '', ...record.tags].join(' ').toLocaleLowerCase();
  return (!type || record.type === type) && (!status || currentStatus(record) === status)
    && (!year || recordYear(record) === year) && words.every(word => searchable.includes(word));
}
export function compareUpdatedDates(a, b, direction = 'desc') {
  const dateA = latestUpdateDate(a);
  const dateB = latestUpdateDate(b);
  const group = date => isCalendarDate(date) ? 0 : date ? 1 : 2;
  // 无论升降序，自定义时期、未知日期均置后；同组按稳定 ID 打破平局。
  return group(dateA) - group(dateB)
    || (group(dateA) === 0 ? dateA.localeCompare(dateB) * (direction === 'desc' ? -1 : 1) : 0)
    || a.id.localeCompare(b.id);
}
