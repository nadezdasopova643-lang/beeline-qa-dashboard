// ✅ НЕТ import! Работаем с глобальным firebase (уже загружен в index.html)

// -> Убедись, что в index.html выше есть:
//    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
//    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
//    <script> firebase.initializeApp(config) </script>

// 🔥 Ссылка на базу данных (уже инициализирована в index.html)
// Если в index.html уже есть: const db = firebase.database();
// Тогда здесь просто используем db

const tasksRef = firebase.database().ref('tasks');  // Храним задачи в /tasks

// =============== ЗАГРУЗКА ЗАДАЧ ПРИ УСТАНОВКЕ ===============
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Страница загружена, загружаем задачи из Firebase');
  loadTasksFromFirebase();
});

// =============== ФУНКЦИЯ: ЗАГРУЗИТЬ ВСЕ ЗАДАЧИ ИЗ FIREBASE ===============
function loadTasksFromFirebase() {
  tasksRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      console.log('Нет задач в базе');
      return;
    }

    // Очищаем таблицы
    document.getElementById('body-operations').innerHTML = '';
    document.getElementById('body-projects').innerHTML = '';
    document.getElementById('body-longterm').innerHTML = '';

    // Проходим по всем задачам
    for (let taskId in data) {
      const task = data[taskId];

      let targetTbody;
      if (task.section === 'Операционные') targetTbody = document.getElementById('body-operations');
      else if (task.section === 'Проектные') targetTbody = document.getElementById('body-projects');
      else if (task.section === 'Долгосрочные') targetTbody = document.getElementById('body-longterm');

      if (targetTbody) {
        const row = document.createElement('tr');
        row.setAttribute('data-section', `section-${task.section}`);
        row.innerHTML = `
          <td style="text-align: center;">${task.number}</td>
          <td class="cell-title">${task.title}</td>
          <td class="cell-meta" data-date="${task.dateAttr}">${formatDateForDisplay(task.dateAttr)}</td>
          <td class="cell-meta">${task.assignee}</td>
          <td>
            <select class="status-select ${task.statusClass || ''}" onchange="updateStatusColor(this)">
              <option value="new" ${task.status === 'new' ? 'selected' : ''}>Новая</option>
              <option value="active" ${task.status === 'active' ? 'selected' : ''}>В работе</option>
              <option value="done" ${task.status === 'done' ? 'selected' : ''}>Закрыто</option>
              <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>В бэклоге</option>
            </select>
          </td>
        `;
        targetTbody.appendChild(row);
        checkOverdue(row);
      }
    }
    updateStats(); // Обновляем счётчики
  });
}

// =============== ФУНКЦИЯ: СОХРАНИТЬ ЗАДАЧУ В FIREBASE ===============
function saveTaskToFirebase(task) {
  tasksRef.push(task)
    .then(() => {
      console.log('✅ Задача сохранена в Firebase');
      updateStats();
    })
    .catch((error) => {
      console.error('❌ Ошибка сохранения:', error);
      alert('Ошибка сети. Проверьте подключение.');
    });
}

// =============== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===============

function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const monthNames = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];
  return `${day} ${monthNames[monthIndex]}`;
}

function checkOverdue(row) {
  const cell = row.querySelector('td:nth-child(3)');
  if (!cell) return;
  const dateAttr = cell.getAttribute('data-date');
  if (!dateAttr) return;
  const dueDate = new Date(dateAttr);
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dueDate < today && !cell.classList.contains('overdue')) {
    cell.classList.add('overdue');
    if (!cell.innerText.includes('!!!')) cell.innerText += ' !!!';
  }
}

function updateStats() {
  const tbodies = [
    document.getElementById('body-operations'),
    document.getElementById('body-projects'),
    document.getElementById('body-longterm')
  ];
  let overdue = 0,
    active = 0;

  tbodies.forEach(tbody => {
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const dateCell = row.querySelector('td:nth-child(3)');
      const select = row.querySelector('select');
      const dateAttr = dateCell?.getAttribute('data-date');
      if (dateAttr) {
        const dueDate = new Date(dateAttr);
        dueDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) overdue++;
      }
      if (select && select.value === 'active') active++;
    });
  });

  const overdueBadge = document.getElementById('count-overdue');
  const activeBadge = document.getElementById('count-active');
  if (overdueBadge) overdueBadge.innerText = overdue;
  if (activeBadge) activeBadge.innerText = active;
}

// =============== ГЛОБАЛЬНЫЕ ФУНКЦИИ (доступны из HTML) ===============

// Функция: добавить задачу
window.addTask = function(e) {
  e.preventDefault();
  console.log('✅ Форма отправлена');

  const type = document.getElementById('taskType').value;
  const title = document.getElementById('taskTitle').value;
  const assignee = document.getElementById('assignee').value || 'Не назначен';
  const date = document.getElementById('dueDate').value;
  const number = getNextNumber(type);

  let sectionName = '';
  let targetTbody = null;

  if (type === 'operations') {
    sectionName = 'Операционные';
    targetTbody = document.getElementById('body-operations');
  } else if (type === 'projects') {
    sectionName = 'Проектные';
    targetTbody = document.getElementById('body-projects');
  } else if (type === 'long-term') {
    sectionName = 'Долгосрочные';
    targetTbody = document.getElementById('body-longterm');
  }

  if (targetTbody && title) {
    const task = {
      number,
      title,
      section: sectionName,
      dateAttr: date,
      assignee,
      status: 'new',
      statusClass: 'status-active'
    };

    // Сохраняем в Firebase
    saveTaskToFirebase(task);

    // Закрываем форму
    document.getElementById('taskForm').reset();
    document.getElementById('taskFormContainer').classList.remove('active');
  } else {
    alert('Не удалось определить секцию');
  }
};

// Функция: переключить архив
window.toggleArchive = function() {
  const archive = document.getElementById('archive-section');
  if (archive) archive.classList.toggle('open');

  const toggleIcon = document.getElementById('archiveToggleIcon');
  if (toggleIcon) {
    toggleIcon.style.transform = archive?.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
  }
};

// Вспомогательные функции
function getNextNumber(type) {
  const idMap = {
    'operations': 'body-operations',
    'projects': 'body-projects',
    'long-term': 'body-longterm'
  };
  const tbody = document.getElementById(idMap[type]);
  return tbody ? tbody.querySelectorAll('tr').length + 1 : 1;
}