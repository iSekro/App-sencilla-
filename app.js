(function () {
  'use strict';

  const STORAGE_KEY = 'app-sencilla:tasks';

  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const list = document.getElementById('task-list');
  const counter = document.getElementById('counter');
  const clearDoneBtn = document.getElementById('clear-done');
  const filterButtons = document.querySelectorAll('.filter');

  let tasks = loadTasks();
  let currentFilter = 'all';

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('No se pudo leer localStorage:', err);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('No se pudo guardar en localStorage:', err);
    }
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    tasks.unshift({ id: createId(), text: trimmed, done: false });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    saveTasks();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function clearDone() {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    render();
  }

  function setFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    render();
  }

  function filteredTasks() {
    switch (currentFilter) {
      case 'active':
        return tasks.filter((t) => !t.done);
      case 'done':
        return tasks.filter((t) => t.done);
      default:
        return tasks;
    }
  }

  function render() {
    list.innerHTML = '';
    const visible = filteredTasks();

    if (visible.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent =
        currentFilter === 'done'
          ? 'No hay tareas hechas todavía.'
          : currentFilter === 'active'
          ? '¡Sin pendientes! Añade una nueva tarea.'
          : 'No hay tareas. Empieza añadiendo una arriba.';
      list.appendChild(empty);
    } else {
      visible.forEach((task) => list.appendChild(renderItem(task)));
    }

    const pending = tasks.filter((t) => !t.done).length;
    counter.textContent =
      pending === 1 ? '1 tarea pendiente' : `${pending} tareas pendientes`;
  }

  function renderItem(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    if (task.done) li.classList.add('done');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.setAttribute('aria-label', 'Borrar tarea');
    del.textContent = '×';
    del.addEventListener('click', () => deleteTask(task.id));

    li.append(checkbox, span, del);
    return li;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = '';
    input.focus();
  });

  clearDoneBtn.addEventListener('click', clearDone);

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  render();
})();
