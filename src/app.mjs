import { TYPES, STATUSES, validateRecords, matchesRecord, sortRecords, yearsOf, validUrl, currentStatus, latestUpdateDate } from './lib.mjs';

const form = document.querySelector('#filters');
const count = document.querySelector('#count');
const expanded = new Set();

function addOptions(selector, entries) {
  const select = document.querySelector(selector);
  for (const [value, label] of entries) select.add(new Option(label, value));
}

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function sourceLink(url, label) {
  const link = textElement('a', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = url;
  return link;
}

function progressText(progress) {
  if (!progress || typeof progress !== 'object') return String(progress ?? '');
  return `${progress.value ?? '—'}${progress.total != null ? ` / ${progress.total}` : ''}${progress.unit ? ` ${progress.unit}` : ''}`;
}

function detailsFor(record) {
  const section = document.createElement('section');
  section.id = `details-${record.id}`;
  section.className = 'record-details';
  section.setAttribute('aria-label', `${record.title}的详情`);
  const fields = document.createElement('dl');
  fields.className = 'detail-fields';
  function field(label, value) {
    if (value === null || value === undefined || value === '') return;
    const group = document.createElement('div');
    const content = document.createElement('dd');
    if (value instanceof Node) content.append(value);
    else content.textContent = Array.isArray(value) ? value.join('、') : String(value);
    if (!content.textContent) return;
    group.append(textElement('dt', label), content);
    fields.append(group);
  }
  field('评分', record.rating === null ? null : `${record.rating} / 5`);
  field('短评', record.comment);
  field('标签', record.tags);
  field('作者', record.author);
  field('书单／片单', record.lists);
  field('进度', record.progress ? progressText(record.progress) : null);
  const links = document.createElement('div');
  links.className = 'record-links';
  record.url.forEach((url, index) => {
    if (url && validUrl(url)) links.append(sourceLink(url, record.url.length === 1 ? '来源 ↗' : `来源 ${index + 1} ↗`));
  });
  if (record.review_url && validUrl(record.review_url)) links.append(sourceLink(record.review_url, record.demo ? '长评示例 ↗' : '长评 ↗'));
  field('链接', links);
  if (fields.childNodes.length) section.append(fields);

  section.append(textElement('h2', '历史'));
  const history = document.createElement('ol');
  history.className = 'history-list';
  record.history.forEach(event => {
    const item = document.createElement('li');
    item.append(textElement('span', event.date || '日期未记', 'history-date'), textElement('span', STATUSES[event.status], 'history-status'));
    if (event.rating != null) item.append(textElement('span', `${event.rating} / 5`, 'history-extra'));
    if (event.progress) item.append(textElement('span', progressText(event.progress), 'history-extra'));
    if (event.comment) item.append(textElement('span', event.comment, 'history-comment'));
    history.append(item);
  });
  section.append(history);
  return section;
}

function toggleRow(row) {
  const id = row.getData().id;
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
  const focused = row.getElement().querySelector('.expand-button') === document.activeElement;
  row.reformat();
  row.normalizeHeight();
  row.getTable().redraw();
  if (focused) row.getElement().querySelector('.expand-button')?.focus({ preventScroll: true });
}

function titleCell(cell) {
  const row = cell.getRow();
  const record = row.getData();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'expand-button';
  button.setAttribute('aria-expanded', String(expanded.has(record.id)));
  button.setAttribute('aria-controls', `details-${record.id}`);
  const caret = textElement('span', '›', 'expand-caret');
  caret.setAttribute('aria-hidden', 'true');
  button.append(caret, textElement('span', record.title));
  button.addEventListener('click', event => { event.stopPropagation(); toggleRow(row); });
  return button;
}

try {
  const response = await fetch(new URL('./data/records.json', import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const records = await response.json();
  const errors = validateRecords(records);
  if (errors.length) throw new Error(errors.join('\n'));
  const demo = records.some(record => record.demo);
  addOptions('#type', Object.entries(TYPES));
  addOptions('#status', Object.entries(STATUSES));
  addOptions('#year', [...yearsOf(records).map(year => [year, `${year} 年`]), ['custom', '自定义时期'], ['unknown', '日期未记']]);

  const table = new Tabulator('#records', {
    data: sortRecords(records).map(record => ({
      ...record, current_status: currentStatus(record), updated_date: latestUpdateDate(record),
    })),
    index: 'id',
    layout: 'fitColumns',
    responsiveLayout: false,
    maxHeight: 'calc(100dvh - 150px)',
    placeholder: records.length ? '没有匹配的记录' : '暂无记录',
    columnDefaults: { vertAlign: 'middle', headerSort: true, resizable: true },
    columns: [
      { title: '名称', field: 'title', minWidth: 100, widthGrow: 4, formatter: titleCell, variableHeight: true },
      { title: '类型', field: 'type', minWidth: 56, widthGrow: 1, formatter: cell => TYPES[cell.getValue()] },
      { title: '状态', field: 'current_status', minWidth: 66, widthGrow: 1.2, formatter: cell => STATUSES[cell.getValue()] },
      { title: '最新更新日期', field: 'updated_date', minWidth: 110, widthGrow: 1.5, formatter: cell => textElement('span', cell.getValue() || '—'), sorter: 'string' },
    ],
    rowFormatter: row => {
      const element = row.getElement();
      element.querySelector('.record-details')?.remove();
      element.classList.toggle('is-expanded', expanded.has(row.getData().id));
      if (expanded.has(row.getData().id)) element.append(detailsFor(row.getData()));
    },
  });
  table.on('rowClick', (event, row) => {
    if (!event.target.closest('a, button, .record-details') && !window.getSelection()?.toString()) toggleRow(row);
  });

  const updateCount = rows => { count.textContent = `${rows.length} / ${records.length} 条${demo ? ' · 全部为虚构示例' : ''}`; };
  table.on('dataFiltered', (_filters, rows) => updateCount(rows));
  table.on('tableBuilt', () => updateCount(table.getRows('active')));

  function applyFilters() {
    const filters = Object.fromEntries(new FormData(form));
    table.setFilter(record => matchesRecord(record, filters));
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', applyFilters);
  form.addEventListener('reset', event => {
    event.preventDefault();
    for (const input of form.querySelectorAll('input,select')) input.value = '';
    table.clearFilter();
  });
} catch (error) {
  count.textContent = '加载失败';
  const message = document.querySelector('#error');
  message.hidden = false;
  message.textContent = '无法加载记录，请检查数据或刷新重试。';
  console.error(error);
}
