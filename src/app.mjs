import { TYPES, STATUSES, validateRecords, matchesRecord, sortRecords, yearsOf, validUrl } from './lib.mjs';

const form = document.querySelector('#filters');
const count = document.querySelector('#count');

function addOptions(selector, entries) {
  const select = document.querySelector(selector);
  for (const [value, label] of entries) select.add(new Option(label, value));
}

function titleCell(cell) {
  const record = cell.getRow().getData();
  const element = document.createElement('div');
  element.className = 'title-cell';
  const title = document.createElement('span');
  title.textContent = record.title;
  element.append(title);
  const links = document.createElement('div');
  links.className = 'record-links';
  record.url.forEach((url, index) => {
    if (!url || !validUrl(url)) return;
    const source = document.createElement('a');
    source.href = url;
    source.textContent = record.url.length === 1 ? '来源 ↗' : `来源 ${index + 1} ↗`;
    source.title = url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    links.append(source);
  });
  if (record.review_url && validUrl(record.review_url)) {
    const review = document.createElement('a');
    review.href = record.review_url;
    review.textContent = record.demo ? '长评示例 ↗' : '长评 ↗';
    review.className = 'review-link';
    review.target = '_blank';
    review.rel = 'noopener noreferrer';
    links.append(review);
  }
  if (links.childNodes.length) element.append(links);
  return element;
}

try {
  const response = await fetch(new URL('./data/records.json', import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const records = await response.json();
  const errors = validateRecords(records);
  if (errors.length) throw new Error(errors.join('\n'));
  const demo = records.some(record => record.demo);
  document.title = `书影音与文化记录${demo ? '（虚构示例）' : ''}`;
  addOptions('#type', Object.entries(TYPES));
  addOptions('#status', Object.entries(STATUSES));
  addOptions('#year', [...yearsOf(records).map(year => [year, `${year} 年`]), ['custom', '自定义时期'], ['unknown', '日期未记']]);

  const table = new Tabulator('#records', {
    data: sortRecords(records),
    index: 'id',
    layout: 'fitColumns',
    responsiveLayout: 'collapse',
    responsiveLayoutCollapseStartOpen: true,
    maxHeight: 'calc(100dvh - 150px)',
    placeholder: records.length ? '没有匹配的记录' : '暂无记录',
    columnDefaults: { vertAlign: 'middle', headerSort: true, resizable: true },
    columns: [
      { title: '名称', field: 'title', minWidth: 210, widthGrow: 2, responsive: 0, formatter: titleCell, variableHeight: true },
      { title: '类型', field: 'type', width: 80, responsive: 4, formatter: cell => TYPES[cell.getValue()] },
      { title: '状态', field: 'status', width: 90, responsive: 3, formatter: cell => STATUSES[cell.getValue()] },
      { title: '日期／时期', field: 'date', width: 125, responsive: 1, formatter: cell => {
        const text = document.createElement('span');
        text.textContent = cell.getValue() || '—';
        return text;
      }, sorter: 'string' },
      { title: '评分', field: 'rating', width: 75, responsive: 2, formatter: cell => cell.getValue() === null ? '—' : `${cell.getValue()} / 5`, sorter: 'number' },
      { title: '短评', field: 'comment', minWidth: 230, widthGrow: 3, responsive: 6, formatter: 'textarea', variableHeight: true },
      { title: '标签', field: 'tags', minWidth: 130, responsive: 5, formatter: cell => {
        const element = document.createElement('span');
        element.textContent = cell.getValue().join('、');
        return element;
      }, headerSort: false },
    ],
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
