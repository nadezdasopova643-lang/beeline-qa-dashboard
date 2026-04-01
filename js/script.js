// =============== ИНИЦИАЛИЗАЦИЯ FIREBASE ===============
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔥 Берём твои ключи — они уже правильные
const firebaseConfig = {
  apiKey: "AIzaSyBi6uJHDsnWjBtcXZdMzsPYCNvK960j5W0",
  authDomain: "beeline-qa-dashboard.firebaseapp.com",
  projectId: "beeline-qa-dashboard",
  storageBucket: "beeline-qa-dashboard.firebasestorage.app",
  messagingSenderId: "694569146308",
  appId: "1:694569146308:web:cdc5e13514c4adfddab691"
};

// Запускаем Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase();
const tasksRef = ref(db, 'tasks');  // данные хранятся в /tasks

// =============== ЗАГРУЗКА ЗАДАЧ ПРИ УСТАНОВКЕ ===============
window.addEventListener('DOMContentLoaded', () => {
  loadTasksFromFirebase();
});

// =============== ФУНКЦИЯ: ЗАГРУЗИТЬ ВСЕ ЗАДАЧИ ИЗ FIREBASE ===============
function loadTasksFromFirebase() {
  onValue(tasksRef, (snapshot) => {
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
  push(tasksRef, task)
    .then(() => {
      console.log('✅ Задача сохранена в Firebase');
      updateStats();
    })
    .catch((error) => {
      console.error('❌ Ошибка сохранения:', error);
      alert('Ошибка сети. Проверьте подключение.');
    });
}

// =============== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (как у тебя, но короче) ===============
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

// =============== СТАНДАРТНЫЙ ОБРАБОТЧИК ФОРМЫ (ИНТЕГРИРОВАН В index.html) ===============
// Убедись, что в index.html у формы есть: onsubmit="addTask(event)"