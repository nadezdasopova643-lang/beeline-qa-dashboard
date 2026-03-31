// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBi6uJHDsnWjBtcXZdMzsPYCNvK960j5W0",
  authDomain: "beeline-qa-dashboard.firebaseapp.com",
  projectId: "beeline-qa-dashboard",
  storageBucket: "beeline-qa-dashboard.firebasestorage.app",
  messagingSenderId: "694569146308",
  appId: "1:694569146308:web:cdc5e13514c4adfddab691"
};

// --- ИНИЦИАЛИЗАЦИЯ ---
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database(); 
// Мы не создаем ссылки заранее, так как будем использовать push() в корень
// const tasksRef = db.ref('tasks'); 

// --- ЛОГИКА ЗАДАЧ ---
const STORAGE_KEY = 'beeline_tasks_data';
const monthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
let stats = { overdue: 0, active: 0 };
let allTasks = [];

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ СОХРАНЕНИЯ (ИСПОЛЬЗУЕТ PUSH) ---
function saveData() {
  console.log('🔄 Попытка сохранения через push...');
  console.log('📦 Данные для сохранения:', allTasks);

  if (!allTasks || allTasks.length === 0) {
    console.warn('⚠️ Нет данных для сохранения!');
    return;
  }

  // Создаем объект с данными и используем push()
  const dataToSave = {
    tasks: allTasks
  };

  // Используем корневой референс и push, чтобы создать новую запись с уникальным ID
  db.ref().push(dataToSave)
    .then(() => {
      console.log('✅ Запись через push успешна!');
      updateStats();
    })
    .catch((error) => {
      console.error('❌ ОШИБКА push:', error);
      // Fallback на локальное сохранение
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
      alert('Ошибка сети. Данные сохранены локально.');
    });
}

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ (ПОНИМАЕТ PUSH) ---
function loadTasksFromCloud() {
  console.log('📥 Загрузка из Firebase (слушаем корень)...');
  
  // Слушаем весь корень базы данных
  db.ref().on('value', (snapshot) => {
    const data = snapshot.val();
    
    // Данные, записанные через push, будут выглядеть так: { "randomId": { tasks: [...] } }
    // Нам нужно найти объект с ключом 'tasks'
    
    let foundTasks = null;
    
    if (data) {
      // Перебираем все элементы (случайные ID)
      for (let key in data) {
        if (data[key] && data[key].tasks) {
          foundTasks = data[key].tasks;
          break; // Нашли последнюю запись, выходим
        }
      }
    }

    if (foundTasks) {
      allTasks = foundTasks;
      renderFromData(allTasks);
    } else if (data && Array.isArray(data)) {
      // Если вдруг сохранили просто массив (старая версия)
      allTasks = data;
      renderFromData(allTasks);
    } else {
      // Если база пуста, загружаем из локального хранилища
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        try {
          allTasks = JSON.parse(localData);
          renderFromData(allTasks);
          // Попытка синхронизировать локальное с облаком (создадим структуру)
          db.ref().push({ tasks: allTasks });
        } catch (e) { console.error('Ошибка локальных данных:', e); }
      } else {
        allTasks = [];
        renderFromData(allTasks);
      }
    }
    updateStats();
  });
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ) ---
function getSectionData(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return [];
  const rows = tbody.querySelectorAll('tr');
  const rowData = [];
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;
    const statusSelect = cells[4].querySelector('select');
    rowData.push({
      number: cells[0]?.innerText || '0',
      title: cells[1]?.innerText || '',
      date: cells[2]?.innerText || '',
      dateAttr: cells[2]?.getAttribute('data-date') || '',
      assignee: cells[3]?.innerText || '',
      status: statusSelect?.value || 'new',
      statusClass: statusSelect?.className || ''
    });
  });
  return rowData;
}
function createRowFromData(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const row = document.createElement('tr');
  const sectionName = tbodyId.replace('body-', 'section-');
  row.setAttribute('data-section', sectionName);
  row.innerHTML = `
    <td class="cell-title" style="text-align: center;">${data.number}</td>
    <td class="cell-title">${data.title}</td>
    <td class="cell-meta" data-date="${data.dateAttr || ''}" data-type="date">${data.date}</td>
    <td class="cell-meta" data-type="name">${data.assignee}</td>
    <td>
      <select class="status-select ${data.statusClass}" onchange="updateStatusColor(this)">
        <option value="new" ${data.status === 'new' ? 'selected' : ''}>Новая</option>
        <option value="active" ${data.status === 'active' ? 'selected' : ''}>В работе</option>
        <option value="done" ${data.status === 'done' ? 'selected' : ''}>Закрыто</option>
        <option value="backlog" ${data.status === 'backlog' ? 'selected' : ''}>В бэклоге</option>
      </select>
    </td>
  `;
  tbody.appendChild(row);
  checkOverdue(row);
}
function updateStatusColor(selectElement) {
  const row = selectElement.closest('tr');
  if (!row) return;
  const statusValue = selectElement.value;
  selectElement.classList.remove('status-active', 'status-done', 'status-backlog');
  if (statusValue === 'done') {
    selectElement.classList.add('status-done');
    moveToArchive(row);
  } else {
    selectElement.classList.add(statusValue === 'active' ? 'status-active' : 'status-backlog');
    removeFromArchive(row);
  }
  allTasks = collectData();
  saveData();
}
function moveToArchive(row) {
  const archiveContent = document.getElementById('archive-content');
  if (!archiveContent) return;
  const newRow = row.cloneNode(true);
  const cellNumber = newRow.querySelector('td:nth-child(1)');
  if (cellNumber) cellNumber.style.display = 'none';
  const select = newRow.querySelector('select');
  if (select) {
    select.disabled = true;
    select.style.cursor = 'default';
    select.classList.remove('status-active', 'status-backlog');
    select.classList.add('status-done');
  }
  archiveContent.appendChild(newRow);
  row.remove();
  allTasks = collectData();
  saveData();
}
function removeFromArchive(row) {
  const archiveContent = document.getElementById('archive-content');
  if (!archiveContent) return;
  const originalTitle = row.querySelector('.cell-title')?.innerText;
  const originalDateAttr = row.querySelector('td:nth-child(3)')?.getAttribute('data-date');
  if (!originalTitle || !originalDateAttr) return;
  const archiveRows = archiveContent.querySelectorAll('tr');
  let foundRow = null;
  archiveRows.forEach(archRow => {
    const archTitle = archRow.querySelector('.cell-title')?.innerText;
    const archDateAttr = archRow.querySelector('td:nth-child(3)')?.getAttribute('data-date');
    if (archTitle === originalTitle && archDateAttr === originalDateAttr) foundRow = archRow;
  });
  if (foundRow) {
    const cellNumber = foundRow.querySelector('td:nth-child(1)');
    if (cellNumber) cellNumber.style.display = 'table-cell';
    const select = foundRow.querySelector('select');
    if (select) {
      select.disabled = false;
      select.style.cursor = 'pointer';
      const currentStatus = select.value;
      if (currentStatus === 'active') select.classList.add('status-active');
      else if (currentStatus === 'backlog') select.classList.add('status-backlog');
      else if (currentStatus === 'new') select.classList.remove('status-active', 'status-backlog');
    }
    const sectionIdToReturn = foundRow.getAttribute('data-section');
    if (sectionIdToReturn) {
      const targetTbody = document.getElementById(`body-${sectionIdToReturn.replace('section-', '')}`);
      if (targetTbody) targetTbody.appendChild(foundRow);
    }
    foundRow.remove();
    allTasks = collectData();
    saveData();
  }
}
function collectData() {
  const data = {
    operations: getSectionData('body-operations'),
    projects: getSectionData('body-projects'),
    longterm: getSectionData('body-longterm')
  };
  const flatData = [];
  ['operations', 'projects', 'longterm'].forEach(key => {
    data[key].forEach(item => {
      let sectionName = '';
      if (key === 'operations') sectionName = 'Операционные';
      if (key === 'projects') sectionName = 'Проектные';
      if (key === 'longterm') sectionName = 'Долгосрочные';
      flatData.push({
        number: item.number,
        section: sectionName,
        title: item.title,
        date: item.dateAttr,
        assignee: item.assignee,
        status: item.status
      });
    });
  });
  return flatData;
}
function updateStats() {
  let overdueCount = 0;
  let activeCount = 0;
  const sections = ['body-operations', 'body-projects', 'body-longterm'];
  sections.forEach(id => {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const cellMeta = row.querySelector('td:nth-child(3) .cell-meta');
      const dateValue = cellMeta?.getAttribute('data-date');
      if (dateValue) {
        const dueDate = new Date(dateValue);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (dueDate < today) overdueCount++;
      }
      const select = row.querySelector('select');
      if (select && select.value === 'active') activeCount++;
    });
  });
  stats.overdue = overdueCount;
  stats.active = activeCount;
  const overdueBadge = document.getElementById('count-overdue');
  const activeBadge = document.getElementById('count-active');
  if (overdueBadge) overdueBadge.innerText = overdueCount;
  if (activeBadge) activeBadge.innerText = activeCount;
  if (overdueCount > 0) {
    const el = document.querySelector('#statsDisplay .stat-item');
    if (el) el.style.opacity = '1';
  }
}
function toggleArchive() {
  const archive = document.getElementById('archive-section');
  if (archive) archive.classList.toggle('open');
  const toggleIcon = document.getElementById('archiveToggleIcon');
  if (toggleIcon) {
    toggleIcon.style.transform = archive?.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}
function checkOverdue(row) {
  const cellMeta = row.querySelector('td:nth-child(3) .cell-meta');
  if (!cellMeta) return;
  const dateValue = cellMeta.getAttribute('data-date') || extractDate(cellMeta.innerText);
  if (dateValue) {
    const dueDate = new Date(dateValue);
    const today = new Date();
    today.setHours(0,0,0,0);
    const rowStatus = row.querySelector('select')?.value;
    if (rowStatus === 'done') return;
    if (dueDate < today) {
      cellMeta.classList.add('overdue');
      if (!cellMeta.innerText.includes('!!!')) cellMeta.innerText += ' !!!';
    } else {
      cellMeta.classList.remove('overdue');
      cellMeta.innerText = cellMeta.innerText.replace(' !!!', '');
    }
  }
}
function extractDate(text) {
  const match = text.match(/(\d{1,2})\s+(\w+)/);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2].toLowerCase();
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex !== -1) {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}
function enableInlineEdit(cell) {
  if (cell.classList.contains('editing')) return;
  cell.classList.add('editing');
  const originalText = cell.innerText.trim();
  const dataType = cell.getAttribute('data-type');
  let input;
  if (dataType === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    const dateVal = cell.getAttribute('data-date');
    if (dateVal) input.value = dateVal;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
  }
  input.className = 'editing-input';
  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
  input.select();
  const saveEdit = (newVal) => {
    cell.classList.remove('editing');
    cell.innerText = newVal;
    if (dataType === 'date') cell.setAttribute('data-date', newVal);
    checkOverdue(cell.closest('tr'));
    allTasks = collectData();
    saveData();
  };
  const cancelEdit = () => {
    cell.classList.remove('editing');
    cell.innerText = originalText;
  };
  input.addEventListener('blur', () => saveEdit(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit(input.value);
    else if (e.key === 'Escape') cancelEdit();
  });
  input.addEventListener('focus', (e) => e.stopPropagation());
}
function renderFromData(data) {
  ['body-operations', 'body-projects', 'body-longterm'].forEach(id => {
    const tbody = document.getElementById(id);
    if (tbody) tbody.innerHTML = '';
  });
  data.forEach(item => {
    const tbodyId = getBodyIdBySection(item.section);
    if (tbodyId) {
      const parsedData = {
        number: item.number,
        title: item.title,
        date: formatDateForDisplay(item.date),
        dateAttr: item.date,
        assignee: item.assignee,
        status: item.status,
        statusClass: getItemClass(item.status)
      };
      createRowFromData(parsedData, tbodyId);
    }
  });
}
function getBodyIdBySection(sectionName) {
  if (sectionName === 'Операционные') return 'body-operations';
  if (sectionName === 'Проектные') return 'body-projects';
  if (sectionName === 'Долгосрочные') return 'body-longterm';
  return 'body-operations';
}
function getItemClass(status) {
  if (status === 'active') return 'status-active';
  if (status === 'done') return 'status-done';
  if (status === 'backlog') return 'status-backlog';
  return '';
}
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const monthName = monthNames[monthIndex];
  if (isNaN(date.getTime())) return dateStr;
  return `${day} ${monthName}`;
}
function getNextNumber(containerId) {
  const tbodyId = `body-${containerId.replace('section-', '')}`;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return 1;
  const rows = tbody.querySelectorAll('tr');
  return rows.length + 1;
}
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Страница загружена. Инициализация...');
  loadTasksFromCloud();
  const rows = document.querySelectorAll('.excel-table tbody tr');
  rows.forEach(row => {
    const section = row.closest('.board-section');
    if (section) {
      row.setAttribute('data-section', section.id);
      checkOverdue(row);
    }
  });
  document.querySelector('.excel-table')?.addEventListener('dblclick', (e) => {
    const cell = e.target.closest('td');
    if (!cell) return;
    const colIndex = Array.from(cell.parentNode.children).indexOf(cell);
    if (colIndex === 2 || colIndex === 3) {
      cell.setAttribute('data-type', colIndex === 2 ? 'date' : 'name');
      enableInlineEdit(cell);
    }
  });
  const formBtn = document.getElementById('toggleFormBtn');
  const cancelBtn = document.getElementById('cancelFormBtn');
  const formContainer = document.getElementById('taskFormContainer');
  const taskForm = document.getElementById('taskForm');
  if(formBtn) formBtn.addEventListener('click', () => formContainer?.classList.add('active'));
  if(cancelBtn) cancelBtn.addEventListener('click', () => formContainer?.classList.remove('active'));
  if(formContainer) formContainer.addEventListener('click', (e) => {
    if (e.target === formContainer) formContainer.classList.remove('active');
  });
  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('taskType').value;
      const title = document.getElementById('taskTitle').value;
      const assignee = document.getElementById('assignee').value || 'Не назначен';
      const date = document.getElementById('dueDate').value;
      let targetTable = null;
      let sectionId = '';
      if (type === 'operations') { sectionId = 'section-operations'; targetTable = document.getElementById('body-operations'); }
      else if (type === 'projects') { sectionId = 'section-projects'; targetTable = document.getElementById('body-projects'); }
      else if (type === 'long-term') { sectionId = 'section-longterm'; targetTable = document.getElementById('body-longterm'); }
      if (targetTable) {
        const dateFormatted = formatDateForDisplay(date);
        const nextNumber = getNextNumber(sectionId);
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-section', sectionId);
        newRow.innerHTML = `
          <td class="cell-title" style="text-align: center;">${nextNumber}</td>
          <td class="cell-title">${title}</td>
          <td class="cell-meta" data-date="${date}" data-type="date">${dateFormatted}</td>
          <td class="cell-meta" data-type="name">${assignee}</td>
          <td>
            <select class="status-select status-active" onchange="updateStatusColor(this)">
              <option value="new" selected>Новая</option>
              <option value="active">В работе</option>
              <option value="done">Закрыто</option>
              <option value="backlog">В бэклоге</option>
            </select>
          </td>
        `;
        targetTable.appendChild(newRow);
        checkOverdue(newRow);
        allTasks = collectData();
        saveData(); // Вызываем сохранение
        taskForm.reset();
        formContainer?.classList.remove('active');
      }
    });
  }
  document.getElementById('exportBtn')?.addEventListener('click', function() {
    let data = [];
    const sections = ['section-operations', 'section-projects', 'section-longterm'];
    sections.forEach(sectionId => {
      const tbodyId = `body-${sectionId.replace('section-', '')}`;
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const number = cells[0]?.innerText.trim() || '';
        const title = cells[1]?.innerText.trim() || '';
        const date = cells[2]?.innerText.trim() || '';
        const owner = cells[3]?.innerText.trim() || '';
        const statusSelect = cells[4]?.querySelector('select');
        const status = statusSelect ? statusSelect.options[statusSelect.selectedIndex].text : 'Новая';
        let sectionName = "Операционные";
        if (sectionId === 'section-projects') sectionName = "Проектные";
        if (sectionId === 'section-longterm') sectionName = "Долгосрочные";
        data.push({ "№": number, "Секция": sectionName, "Название задачи": title, "Срок": date, "Ответственный": owner, "Статус": status });
      });
    });
    if (data.length === 0) { alert("Нет задач для экспорта!"); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    const wscols = [{wch: 5}, {wch: 20}, {wch: 35}, {wch: 15}, {wch: 20}, {wch: 15}];
    ws['!cols'] = wscols;
    XLSX.utils.book_append_sheet(wb, ws, "Задачи");
    const date = new Date();
    const fileName = `Tasks_Export_${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  });
  updateStats();
});