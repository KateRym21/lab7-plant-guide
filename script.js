'use strict';

/* =====================================================
   Гід по кімнатних рослинах: JavaScript
   Що тут є:
   1. Утиліти та сповіщення (toast)
   2. Темна / світла тема
   3. Анімація листочків у верхньому блоці
   4. Картки: полив кліком (краплі) і кнопка «В мій садок»
   5. Пошук і фільтр карток
   6. «Мій садок»: динамічні елементи, вологість ґрунту
   7. Поява елементів при прокрутці
   8. Кнопка «Нагору»
   ===================================================== */

const DEBUG = true; // false вимикає повідомлення в консолі
function log(...args) {
  if (DEBUG) console.log('[Гід]', ...args);
}

/* ---------- 1. Утиліти ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let toastTimer;
function showToast(text) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div'); // динамічне створення елемента
    toast.id = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------- 2. Тема ---------- */
const themeBtn = $('#themeBtn');

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  themeBtn.textContent = isDark ? '☀️ Світла' : '🌙 Темна';
  themeBtn.setAttribute('aria-pressed', String(isDark));
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem('theme');
} catch (error) {
  log('localStorage недоступний:', error);
}
applyTheme(savedTheme === 'dark');

themeBtn.addEventListener('click', () => {
  const isDark = !document.body.classList.contains('dark');
  applyTheme(isDark);
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch (error) {
    log('Не вдалося зберегти тему:', error);
  }
  log('Тема змінена на:', isDark ? 'темну' : 'світлу');
});

/* ---------- 3. Листочки, що падають ---------- */
function createLeaves(count) {
  const box = $('#leaves');
  const symbols = ['🍃', '🌿', '🍀', '🌱'];
  for (let i = 0; i < count; i++) {
    const leaf = document.createElement('span');
    leaf.className = 'leaf';
    leaf.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    leaf.style.left = Math.random() * 100 + '%';
    leaf.style.fontSize = 16 + Math.random() * 20 + 'px';
    leaf.style.animationDuration = 7 + Math.random() * 8 + 's';
    leaf.style.animationDelay = -Math.random() * 10 + 's';
    leaf.style.setProperty('--sway', Math.random() * 80 - 40 + 'px');
    box.appendChild(leaf);
  }
  log('Створено листочків:', count);
}

if (!reduceMotion) {
  createLeaves(window.innerWidth < 600 ? 8 : 16);
}

/* ---------- 4. Картки рослин ---------- */
const cards = $$('.card');
const waterCount = new Map(); // назва рослини -> скільки разів полили

function spawnDrop(box) {
  const drop = document.createElement('span');
  drop.className = 'drop';
  drop.textContent = '💧';
  drop.style.left = 10 + Math.random() * 80 + '%';
  drop.style.animationDelay = Math.random() * 0.4 + 's';
  box.appendChild(drop);
  drop.addEventListener('animationend', () => drop.remove());
}

function waterCard(name, imgBox, emojiEl, badge) {
  const count = (waterCount.get(name) || 0) + 1;
  waterCount.set(name, count);

  badge.textContent = '💧 ' + count;
  badge.hidden = false;

  for (let i = 0; i < 8; i++) spawnDrop(imgBox);

  // перезапуск CSS-анімації «підстрибування»
  emojiEl.classList.remove('bounce');
  void emojiEl.offsetWidth;
  emojiEl.classList.add('bounce');

  log(`Полили "${name}", разів: ${count}`);
  if (count === 5) {
    showToast('Ой, забагато води! Від перезволоження коріння може загнити 😅');
  }
}

cards.forEach((card) => {
  const name = $('h3', card).textContent.trim();
  const imgBox = $('.card-img', card);
  const emoji = imgBox.textContent.trim();

  // дані для пошуку та фільтра зберігаємо в data-атрибутах
  const levelTag = $('.tags li:nth-child(2)', card);
  card.dataset.name = name.toLowerCase();
  card.dataset.level = levelTag
    ? levelTag.textContent.replace('Рівень:', '').trim().toLowerCase()
    : '';

  // перебудовуємо блок із картинкою: емодзі, лічильник, підказка
  imgBox.textContent = '';
  imgBox.removeAttribute('aria-hidden');
  imgBox.setAttribute('role', 'button');
  imgBox.setAttribute('tabindex', '0');
  imgBox.setAttribute('aria-label', `Полити: ${name}`);

  const emojiEl = document.createElement('span');
  emojiEl.className = 'emoji';
  emojiEl.textContent = emoji;

  const badge = document.createElement('span');
  badge.className = 'water-badge';
  badge.hidden = true;

  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.textContent = '👆 Натисни, щоб полити';

  imgBox.append(emojiEl, badge, hint);

  // подія: клік мишею та клавіатурою
  const water = () => waterCard(name, imgBox, emojiEl, badge);
  imgBox.addEventListener('click', water);
  imgBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      water();
    }
  });

  // кнопка «В мій садок»
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-btn';
  addBtn.textContent = '🪴 В мій садок';
  addBtn.addEventListener('click', () => addToGarden(name, emoji));
  $('.card-body', card).appendChild(addBtn);
});

/* ---------- 5. Пошук і фільтр ---------- */
const searchInput = $('#search');
const levelSelect = $('#level');
const noResults = $('#noResults');

function filterCards() {
  const query = searchInput.value.trim().toLowerCase();
  const level = levelSelect.value;
  let shown = 0;

  cards.forEach((card) => {
    const matches =
      card.dataset.name.includes(query) &&
      (level === 'all' || card.dataset.level === level);
    card.hidden = !matches;
    if (matches) shown++;
  });

  noResults.hidden = shown !== 0;
  log(`Фільтр: запит "${query}", рівень "${level}", знайдено: ${shown}`);
}

searchInput.addEventListener('input', filterCards);
levelSelect.addEventListener('change', filterCards);

/* ---------- 6. Мій садок ---------- */
const garden = []; // масив об'єктів-рослин
const gardenList = $('#gardenList');
const gardenEmpty = $('#gardenEmpty');

function updateGardenEmpty() {
  gardenEmpty.hidden = garden.length > 0;
}

function updatePlant(plant) {
  plant.fill.style.width = plant.moisture + '%';
  plant.fill.classList.toggle('low', plant.moisture < 30);
  plant.fill.classList.toggle('high', plant.moisture > 85);
  plant.li.classList.toggle('thirsty', plant.moisture < 30);

  let state = 'усе гаразд';
  if (plant.moisture < 30) state = 'потрібен полив!';
  else if (plant.moisture > 85) state = 'достатньо води';
  plant.status.textContent = `Вологість ґрунту: ${plant.moisture}% — ${state}`;
}

function waterGardenPlant(plant) {
  if (plant.moisture >= 90) {
    showToast(`${plant.name}: ґрунт ще вологий. Перелив шкодить! 🚫`);
    log('Спроба переливу:', plant.name);
    return;
  }
  plant.moisture = Math.min(100, plant.moisture + 40);
  plant.warned = false;
  for (let i = 0; i < 6; i++) spawnDrop(plant.li);
  updatePlant(plant);
  log(`Полили в садку "${plant.name}", вологість: ${plant.moisture}%`);
}

function addToGarden(name, emoji) {
  if (garden.some((plant) => plant.name === name)) {
    showToast(`${name} уже є у вашому садку 🌱`);
    return;
  }

  // створюємо елементи списку за допомогою DOM
  const li = document.createElement('li');
  li.className = 'garden-item';

  const emojiEl = document.createElement('span');
  emojiEl.className = 'g-emoji';
  emojiEl.textContent = emoji;

  const info = document.createElement('div');
  info.className = 'g-info';
  const title = document.createElement('strong');
  title.textContent = name;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  bar.appendChild(fill);
  const status = document.createElement('small');
  info.append(title, bar, status);

  const actions = document.createElement('div');
  actions.className = 'g-actions';
  const waterBtn = document.createElement('button');
  waterBtn.type = 'button';
  waterBtn.className = 'water-btn';
  waterBtn.textContent = '💧 Полити';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '✖';
  removeBtn.setAttribute('aria-label', `Видалити ${name}`);
  actions.append(waterBtn, removeBtn);

  li.append(emojiEl, info, actions);
  gardenList.appendChild(li);

  const plant = { name, moisture: 60, warned: false, li, fill, status };
  garden.push(plant);
  updatePlant(plant);
  updateGardenEmpty();

  waterBtn.addEventListener('click', () => waterGardenPlant(plant));
  removeBtn.addEventListener('click', () => {
    garden.splice(garden.indexOf(plant), 1);
    li.remove();
    updateGardenEmpty();
    log('Видалено з садка:', name);
  });

  showToast(`${name} додано! Дивіться розділ «Мій садок» 🪴`);
  log('Додано в садок:', name, '| тепер у садку:', garden.map((p) => p.name));
}

// кожні 3 секунди ґрунт трохи підсихає
setInterval(() => {
  garden.forEach((plant) => {
    plant.moisture = Math.max(0, plant.moisture - 2);
    updatePlant(plant);
    if (plant.moisture < 30 && !plant.warned) {
      plant.warned = true;
      showToast(`${plant.name} хоче пити! 💧`);
      log('Потрібен полив:', plant.name);
    }
  });
}, 3000);

/* ---------- 7. Поява елементів при прокрутці ---------- */
if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('in');
        observer.unobserve(el);
        // після анімації повертаємо елементу звичайні стилі
        setTimeout(() => {
          el.classList.remove('reveal', 'in');
          el.style.transitionDelay = '';
        }, 900);
      });
    },
    { threshold: 0.15 }
  );

  $$('.rule, .card, .table-wrap, details').forEach((el, index) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (index % 3) * 100 + 'ms';
    observer.observe(el);
  });
}

/* ---------- 8. Кнопка «Нагору» ---------- */
const toTop = $('#toTop');
window.addEventListener('scroll', () => {
  toTop.classList.toggle('show', window.scrollY > 400);
});
toTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Налагодження в консолі ---------- */
log('Сторінку завантажено. Карток рослин:', cards.length);
console.table(
  cards.map((card) => ({ рослина: card.dataset.name, складність: card.dataset.level }))
);
