const STORAGE_KEY = 'oneul-attendance-v1';
const statuses = ['present', 'late', 'early', 'absent', 'unset'];
const periodCount = 7;
const statusNames = { present: '출석', late: '지각', early: '조퇴', absent: '결석', unset: '미확인' };
const sampleNames = ['김민준','이서연','박지호','최예준','정하은','강도윤','조유나','윤서준','장하린','임시우','한지민','오지안','서준혁','신예은','권도현','황수아','안지후','송채원','전민재','홍서윤','문유찬','양다은','배현우','백소율'];
const colors = ['#eef2ff','#eaf8f2','#fff3e8','#f5efff','#fff0f1','#eaf5fb'];

const dateInput = document.querySelector('#date-picker');
const rowsNode = document.querySelector('#student-rows');
const initialDate = new Date();
const localDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
let selectedDate = localDateString(initialDate);
let activeFilter = 'all';
let searchQuery = '';

function createInitialData() {
  const students = sampleNames.map((name, index) => ({ id: `s${index + 1}`, number: index + 1, name }));
  const records = {};
  const day = initialDate.getDate();
  for (let offset = Math.min(day - 1, 20); offset >= 0; offset--) {
    const date = new Date(initialDate);
    date.setDate(day - offset);
    const key = localDateString(date);
    records[key] = {};
    students.forEach((student, index) => {
      if (offset === 0) {
        records[key][student.id] = index < 19 ? 'present' : index < 21 ? 'late' : index === 21 ? 'early' : index === 22 ? 'absent' : 'unset';
      } else {
        const pattern = (index * 7 + offset * 3) % 31;
        records[key][student.id] = pattern === 0 ? 'absent' : pattern < 3 ? 'late' : pattern === 3 ? 'early' : 'present';
      }
    });
  }
  return { students, records, periodAttendance: {}, reasons: {} };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data && typeof data === 'object' && Array.isArray(data.students) && data.records && typeof data.records === 'object') {
        data.periodAttendance ||= {};
        data.reasons ||= {};
        return data;
      }
    }
  } catch (error) {
    console.warn('출결 저장 데이터를 불러오지 못했습니다.', error);
  }
  return createInitialData();
}

let data = loadData();
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.querySelector('.saved-state').innerHTML = '<span class="saved-check">✓</span> 자동 저장됨';
  } catch (error) {
    console.error('출결 데이터를 저장하지 못했습니다.', error);
    document.querySelector('.saved-state').textContent = '저장 실패 · 브라우저 저장 공간을 확인해 주세요';
  }
}

function getStatus(studentId, date = selectedDate) {
  return data.records[date]?.[studentId] || 'unset';
}
function setStatus(studentId, status) {
  if (!statuses.includes(status)) return;
  data.records[selectedDate] ||= {};
  data.records[selectedDate][studentId] = status;
  persist();
  render();
}
function getPeriodMarks(studentId, date = selectedDate) {
  return data.periodAttendance[date]?.[studentId] || Array(periodCount).fill(false);
}
function setPeriodMark(studentId, period) {
  data.periodAttendance[selectedDate] ||= {};
  const marks = [...getPeriodMarks(studentId)];
  marks[period] = !marks[period];
  data.periodAttendance[selectedDate][studentId] = marks;
  persist();
  renderRows();
}
function getReason(studentId, date = selectedDate) {
  return data.reasons[date]?.[studentId] || '';
}
function countsForDate(date) {
  const result = { present: 0, late: 0, early: 0, absent: 0, unset: 0 };
  data.students.forEach(({ id }) => { result[getStatus(id, date)] += 1; });
  return result;
}
function monthRecords() {
  const [year, month] = selectedDate.split('-').map(Number);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const result = { present: 0, late: 0, early: 0, absent: 0 };
  Object.entries(data.records).forEach(([date, daily]) => {
    if (!date.startsWith(monthPrefix)) return;
    Object.values(daily).forEach((status) => { if (status in result) result[status] += 1; });
  });
  return result;
}
function studentMonthCounts(studentId) {
  const [year, month] = selectedDate.split('-');
  const prefix = `${year}-${month}-`;
  const result = { present: 0, late: 0, early: 0, absent: 0 };
  Object.entries(data.records).forEach(([date, daily]) => {
    if (date.startsWith(prefix) && daily[studentId] in result) result[daily[studentId]] += 1;
  });
  return result;
}
function formatSelectedDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const weekdays = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}`;
}
function renderRows() {
  const visible = data.students.filter((student) => {
    const status = getStatus(student.id);
    const matchesStatus = activeFilter === 'all' || status === activeFilter;
    const query = searchQuery.trim().toLocaleLowerCase('ko');
    return matchesStatus && (!query || student.name.toLocaleLowerCase('ko').includes(query) || String(student.number).includes(query));
  });
  rowsNode.innerHTML = visible.map((student) => {
    const status = getStatus(student.id);
    const monthly = studentMonthCounts(student.id);
    const periodMarks = getPeriodMarks(student.id);
    const periodCells = periodMarks.map((marked, period) => `<td class="period-cell"><button type="button" class="period-mark ${marked ? 'marked' : ''}" data-student="${escapeHtml(student.id)}" data-period="${period}" aria-label="${escapeHtml(student.name)} ${period + 1}교시 ${marked ? '출석 표시됨' : '출석 표시 안 됨'}" aria-pressed="${marked}">${marked ? '/' : ''}</button></td>`).join('');
    const options = statuses.map((option) => `<option value="${option}" ${option === status ? 'selected' : ''}>${statusNames[option]}</option>`).join('');
    return `<tr>
      <td class="student-number">${String(student.number).padStart(2, '0')}</td>
      <td><div class="student-cell"><span class="student-initial" style="background:${colors[(student.number - 1) % colors.length]}">${student.name[0]}</span>${escapeHtml(student.name)}</div></td>
      <td><select class="status-select status-${status}" aria-label="${escapeHtml(student.name)} 출결 상태" data-student="${escapeHtml(student.id)}">${options}</select></td>${periodCells}
      <td><input class="reason-input" type="text" maxlength="120" placeholder="사유 입력" aria-label="${escapeHtml(student.name)} 출결 사유" data-student="${escapeHtml(student.id)}" value="${escapeHtml(getReason(student.id))}"></td>
      <td class="count-cell count-highlight">${monthly.present}</td><td class="count-cell">${monthly.late}</td><td class="count-cell">${monthly.early}</td><td class="count-cell">${monthly.absent}</td>
    </tr>`;
  }).join('');
  document.querySelector('#empty-state').hidden = visible.length > 0;
  document.querySelector('#showing-count').textContent = `학생 ${visible.length}명`;
  document.querySelector('#filter-all-count').textContent = String(data.students.length);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function renderChart() {
  const [year, month, day] = selectedDate.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const totals = chartDays.map((date) => {
    const key = localDateString(date);
    return { day: date.getDate(), present: countsForDate(key).present, today: key === selectedDate };
  });
  const max = Math.max(1, ...totals.map((entry) => entry.present));
  document.querySelector('#mini-chart').innerHTML = totals.map((entry) => `<div class="chart-bar-wrap"><div class="chart-bar ${entry.today ? 'today' : ''}" style="height:${Math.max(7, entry.present / max * 100)}%" title="${entry.day}일 출석 ${entry.present}명"></div></div>`).join('');
  document.querySelector('#chart-labels').innerHTML = totals.map((entry) => `<span>${entry.day}</span>`).join('');
}
function render() {
  const daily = countsForDate(selectedDate);
  const monthly = monthRecords();
  const completed = data.students.length - daily.unset;
  const rate = data.students.length ? Math.round((daily.present / data.students.length) * 100) : 0;
  document.querySelector('#date-label').textContent = formatSelectedDate(selectedDate);
  dateInput.value = selectedDate;
  document.querySelector('#total-count').innerHTML = `${data.students.length}<span>명</span>`;
  document.querySelector('#present-count').innerHTML = `${daily.present}<span>명</span>`;
  document.querySelector('#late-early-count').innerHTML = `${daily.late + daily.early}<span>명</span>`;
  document.querySelector('#absent-count').innerHTML = `${daily.absent}<span>명</span>`;
  document.querySelector('#present-note').textContent = `확인 ${completed}명 · 미확인 ${daily.unset}명`;
  document.querySelector('#attendance-rate').textContent = `${rate}%`;
  document.querySelector('#attendance-progress').style.width = `${rate}%`;
  document.querySelector('#summary-present').textContent = daily.present;
  document.querySelector('#summary-late').textContent = daily.late;
  document.querySelector('#summary-early').textContent = daily.early;
  document.querySelector('#summary-absent').textContent = daily.absent;
  document.querySelector('#month-label').textContent = `${Number(selectedDate.slice(5, 7))}월 출결 기록`;
  const total = monthly.present + monthly.late + monthly.early + monthly.absent;
  document.querySelector('#month-total').textContent = total.toLocaleString('ko-KR');
  document.querySelector('#month-present').textContent = monthly.present;
  document.querySelector('#month-late').textContent = monthly.late;
  document.querySelector('#month-early').textContent = monthly.early;
  document.querySelector('#month-absent').textContent = monthly.absent;
  renderRows();
  renderChart();
}
function moveDate(amount) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  selectedDate = localDateString(date);
  render();
}

document.querySelector('#previous-day').addEventListener('click', () => moveDate(-1));
document.querySelector('#next-day').addEventListener('click', () => moveDate(1));
document.querySelector('#today-button').addEventListener('click', () => { selectedDate = localDateString(new Date()); render(); });
document.querySelector('#date-display').addEventListener('click', () => dateInput.showPicker?.());
dateInput.addEventListener('change', () => { if (dateInput.value) { selectedDate = dateInput.value; render(); } });
document.querySelector('#all-present').addEventListener('click', () => {
  data.records[selectedDate] ||= {};
  data.students.forEach(({ id }) => { data.records[selectedDate][id] = 'present'; });
  persist();
  render();
});
document.querySelector('#search-input').addEventListener('input', (event) => { searchQuery = event.target.value; renderRows(); });
document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('selected', item === button));
  renderRows();
}));
rowsNode.addEventListener('change', (event) => {
  const select = event.target.closest('.status-select');
  if (select) setStatus(select.dataset.student, select.value);
});
rowsNode.addEventListener('click', (event) => {
  const mark = event.target.closest('.period-mark');
  if (mark) setPeriodMark(mark.dataset.student, Number(mark.dataset.period));
});
rowsNode.addEventListener('input', (event) => {
  const input = event.target.closest('.reason-input');
  if (!input) return;
  data.reasons[selectedDate] ||= {};
  data.reasons[selectedDate][input.dataset.student] = input.value;
  persist();
});
document.querySelector('#export-button').addEventListener('click', () => {
  const headers = ['날짜','번호','학생 이름','출결 상태', ...Array.from({ length: periodCount }, (_, index) => `${index + 1}교시`), '사유'];
  const lines = [headers, ...data.students.map((student) => [
    selectedDate,
    student.number,
    student.name,
    statusNames[getStatus(student.id)],
    ...getPeriodMarks(student.id).map((marked) => marked ? '/' : ''),
    getReason(student.id)
  ])];
  const csv = '\uFEFF' + lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `출결-${selectedDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});
const dialog = document.querySelector('#student-dialog');
document.querySelector('#manage-students').addEventListener('click', () => dialog.showModal());
document.querySelector('.nav-item[href="#students"]').addEventListener('click', (event) => {
  event.preventDefault();
  dialog.showModal();
});
document.querySelector('#student-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#student-name');
  const name = input.value.trim();
  if (!name) return;
  data.students.push({ id: `s${crypto.randomUUID()}`, number: Math.max(0, ...data.students.map((student) => student.number)) + 1, name });
  persist();
  dialog.close();
  input.value = '';
  render();
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#search-input').focus();
  }
});

document.querySelector('#manage-students').textContent = '학생 추가 →';
render();
