const RU = {
  nav_work: "Работы",
  nav_about: "Обо мне",
  nav_contact: "Контакты",
  hero_hello: "Привет, я Make.",
  hero_lead: "Проектирую и разрабатываю сайты, веб-приложения и интерактивные презентации: от первого эскиза до запуска.",
  hero_h1: "<span>Веб-</span><span>разработчик</span>",
  work_h2: "Избранные<br>работы",
  work_sub: "Три проекта из разных областей: интерактивная презентация, full-stack веб-приложение и приложение с компьютерным зрением. Все работают онлайн.",
  p1_kind: "Full-stack приложение",
  p1_sum: "Трекер питания с распознаванием фото. Пользователь фотографирует блюдо, за секунды получает калории и БЖУ, при необходимости правит их и ведёт дневник.",
  built_h: "Возможности",
  p1_built: "<li>Аккаунты, личный профиль и дневные нормы</li><li>Распознавание фото с помощью ИИ и оценкой точности для каждого блюда</li><li>Дневник питания, история и персональные рекомендации</li>",
  p1_note: "Демо работает на бесплатном сервере, поэтому первая загрузка может занять до минуты.",
  live: "Смотреть демо",
  code: "Исходный код",
  u_kind: "Интерактивная веб-презентация",
  u_sum: "Интерактивная презентация приморского города. Посетитель исследует иллюстрированную карту, открывает локации и попадает в полноэкранные сцены, которые реагируют на каждый клик.",
  u_built: "<li>Анимированная карта с маршрутом по пяти локациям</li><li>Кликабельные сцены с режимами день и ночь и местом под видео для каждой локации</li><li>Прямые ссылки на любую локацию, готовые для встраивания в существующий сайт</li>",
  u_note: "Saltmere: концепт-проект. Сделан без фреймворков, поэтому работает на любом хостинге.",
  k_kind: "Веб-приложение с компьютерным зрением",
  k_sum: "Решатель кубика Рубика. Приложение считывает кубик через камеру, проверяет его и пошагово ведёт к решению на интерактивной 3D-модели.",
  k_built: "<li>Собственное распознавание через камеру, полностью в браузере</li><li>Два метода сборки с 3D-анимацией, регулировкой скорости и пояснениями</li><li>Понятные сообщения об ошибке, если кубик невозможно собрать</li>",
  k_note: "Интерфейс на русском. Видео с камеры обрабатывается в браузере и никуда не отправляется.",
  about_h2: "Обо мне",
  about_label: "Кратко",
  about_text: "Я Make, веб-разработчик. Веду проекты от идеи до запуска: дизайн интерфейса, фронтенд, бэкенд, базы данных, ИИ-функции и деплой. Вы получаете работающий продукт, чистый код, который принадлежит вам, и понятную связь на каждом этапе.",
  tbl_area: "Направление",
  tbl_tools: "Инструменты",
  tbl_use: "Для чего",
  t1_a: "Интерфейс",
  t1_u: "Дизайн интерфейсов и адаптивная вёрстка",
  t2_a: "Сервер",
  t2_u: "API и авторизация",
  t3_a: "Данные",
  t3_u: "Схемы и миграции",
  t4_a: "ИИ-функции",
  t4_u: "Анализ фото и текста",
  t5_a: "Запуск",
  t5_u: "Хостинг, HTTPS, деплой",
  services_label: "Услуги",
  services_list: "<li>Сайты и лендинги для бизнеса</li><li>Веб-приложения: аккаунты, панели управления, базы данных</li><li>Интерактивные презентации, карты и обзоры продуктов</li><li>Дизайн интерфейсов и фронтенд-разработка</li><li>ИИ-функции: анализ фото и текста</li><li>Запуск и поддержка: домен, хостинг, обновления</li>",
  contact_h2: "Обсудим ваш проект",
  contact_sub: "Опишите задачу в двух словах. Отвечаю в течение дня.",
  foot_links: "Ссылки",
  foot_connect: "Связь",
  foot_tag: "Сайты и веб-приложения: от дизайна до запуска.",
  marquee: "Веб-разработчик",
  skip: "Перейти к содержанию",
};

const TITLES = {
  en: "Make - Web Developer",
  ru: "Make - Веб-разработчик",
};

const DESCS = {
  en: "Make, web developer: websites, web apps and interactive presentations, from design to launch.",
  ru: "Make, веб-разработчик: сайты, веб-приложения и интерактивные презентации, от дизайна до запуска.",
};

const nodes = [...document.querySelectorAll("[data-i18n]")];
nodes.forEach((el) => (el.dataset.en = el.innerHTML));
const metaDesc = document.querySelector('meta[name="description"]');

function setLang(lang) {
  nodes.forEach((el) => {
    const key = el.dataset.i18n;
    el.innerHTML = lang === "ru" && RU[key] ? RU[key] : el.dataset.en;
  });
  document.documentElement.lang = lang;
  document.title = TITLES[lang];
  metaDesc.setAttribute("content", DESCS[lang]);
  document.querySelectorAll(".lang button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  });
  try {
    localStorage.setItem("lang", lang);
  } catch {}
}

document.querySelectorAll(".lang button").forEach((b) => {
  b.addEventListener("click", () => setLang(b.dataset.lang));
});

let saved = "en";
try {
  saved = localStorage.getItem("lang") || "en";
} catch {}
if (saved === "ru") setLang("ru");

/* ---------- contacts ---------- */

// Paste the links here. A button with an empty value stays hidden.
const CONTACTS = {
  upwork: "",
  whatsapp: "", // https://wa.me/<number with country code, digits only>
  telegram: "", // https://t.me/<username>
  email: "", // mailto:<address>
  linkedin: "",
  github: "https://github.com/Myrrzec",
};

document.querySelectorAll("[data-contact]").forEach((a) => {
  const url = CONTACTS[a.dataset.contact];
  if (url) a.href = url;
  else a.hidden = true;
});

/* ---------- motion ---------- */

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// start the hero intro once fonts are in (or after a short cap), so nothing jumps mid-animation
Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 700))]).then(() =>
  requestAnimationFrame(() => root.classList.add("is-ready"))
);

// tag elements for scroll reveal; stagger siblings with --d
function tag(selector, kind = "", step = 0.08) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.dataset.reveal = kind;
    if (step) el.style.setProperty("--d", `${Math.min(i, 8) * step}s`);
  });
}
tag(".mega, .wordmark", "mask", 0);
tag(".work__sub", "", 0);
tag(".cover", "cover", 0);
document.querySelectorAll(".info").forEach((info) => {
  [...info.children].forEach((el, i) => {
    el.dataset.reveal = "";
    el.style.setProperty("--d", `${Math.min(i, 8) * 0.07}s`);
  });
});
tag(".split > *", "", 0.1);
tag(".tbl", "", 0);
tag(".ticket", "", 0);
tag(".foot__cols > *", "", 0.1);

const revealed = document.querySelectorAll("[data-reveal]");
if (reduce || !("IntersectionObserver" in window)) {
  revealed.forEach((el) => el.classList.add("is-in", "is-settled"));
} else {
  const show = (el) => {
    el.classList.add("is-in");
    setTimeout(() => el.classList.add("is-settled"), 1600);
    if (el.classList.contains("cover")) countUp(el.querySelector(".ring b"));
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        show(e.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  // a fully clipped element never reports an intersection, so masked text watches its parent
  const masks = new Map();
  const mo = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        mo.unobserve(e.target);
        show(masks.get(e.target));
      });
    },
    { rootMargin: "0px 0px -15% 0px" }
  );
  revealed.forEach((el) => {
    if (el.dataset.reveal === "mask") {
      masks.set(el.parentElement, el);
      mo.observe(el.parentElement);
    } else io.observe(el);
  });
}

// idle animations in the covers only run while visible
const covers = document.querySelectorAll(".cover");
if (!reduce && "IntersectionObserver" in window) {
  const live = new IntersectionObserver((entries) =>
    entries.forEach((e) => e.target.classList.toggle("is-live", e.isIntersecting))
  );
  covers.forEach((c) => live.observe(c));
}

function countUp(el) {
  if (!el || el.dataset.counted) return;
  el.dataset.counted = "1";
  const target = parseInt(el.textContent, 10);
  const start = performance.now() + 600;
  const dur = 1800;
  const step = (now) => {
    const t = Math.min(Math.max((now - start) / dur, 0), 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = "0";
  requestAnimationFrame(step);
}

// current section in the nav
const pills = [...document.querySelectorAll(".pills a")];
if ("IntersectionObserver" in window) {
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        pills.forEach((p) => p.setAttribute("aria-current", String(p.hash === `#${e.target.id}`)));
      }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("#top, #work, #about, #contact").forEach((s) => spy.observe(s));
}

// hide the nav while scrolling down, show it again on the way up
const nav = document.querySelector(".nav");
let lastY = scrollY;
let ticking = false;

function onFrame() {
  ticking = false;
  const y = scrollY;
  const dy = y - lastY;
  lastY = y;

  if (Math.abs(dy) > 4) nav.classList.toggle("is-hidden", dy > 0 && y > innerHeight * 0.6);
  if (y < 40) nav.classList.remove("is-hidden");
}
addEventListener(
  "scroll",
  () => {
    if (!ticking) requestAnimationFrame(onFrame);
    ticking = true;
  },
  { passive: true }
);
