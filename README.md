# Smart To-Do · Розумний список задач з Google Calendar

Розумний та естетичний планувальник завдань з автоматичною двосторонньою синхронізацією з **Google Calendar API** та авторизацією **OAuth 2.0 PKCE**.

![Palette: Slate #202940 / Brown #4B4038 / Taupe #9A8678 / Sand #CAAA98](https://placehold.co/600x80/202940/CAAA98?text=SMART+TO-DO+·+GOOGLE+CALENDAR&font=mono)

---

## Функціонал

- 🗓️ **Інтеграція з Google Calendar** — завдання автоматично створюються, редагуються та видаляються у вашому реальному Google Календарі.
- 🔐 **OAuth 2.0 PKCE** — безпечна авторизація на стороні клієнта (SPA) без використання сторонніх серверів чи баз даних.
- 💻 **Локальний режим (Offline)** — додаток працює як локальний To-Do список через `localStorage` навіть без авторизації Google.
- 🔄 **Пакетна синхронізація** — кнопка «Синхронізувати все» для автоматичного вивантаження локальних завдань у календар після входу.
- 📝 **Форми та Валідація** — детальні перевірки вводу (назва від 3-х символів, дата завершення не може бути ранішою за дату початку).
- 🎨 **Преміальний дизайн** — адаптивний скляний інтерфейс (glassmorphism) на основі спеціальної колірної палітри з мікроанімаціями.
- 🛡️ **Кібербезпека** — впроваджено захист від CSRF атак через перевірку OAuth `state` та захист від XSS через Content Security Policy (CSP).

---

## Дизайн та Палітра

Інтерфейс побудований на глибоких темних та теплих земляних відтінках:
- **Основний фон**: Slate Blue `#202940`
- **Картки та панелі**: Deep Warm Brown `#4B4038`
- **Межі та другорядний текст**: Muted Taupe `#9A8678`
- **Акценти та активний текст**: Light Warm Sand `#CAAA98`
- **Шрифт**: [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts)

---

## Запуск локально

```bash
# Встановлення залежностей
npm install

# Запуск сервера розробки
npm run dev
```

Відкрийте у браузері: **http://127.0.0.1:3000**

---

## Налаштування Google Cloud Console

Оскільки додаток є статичним клієнтським додатком (SPA), для роботи з календарем потрібні власні облікові дані Google API:

### 1. Налаштування екрану згоди (OAuth consent screen)
1. Перейдіть у [Google Cloud Console](https://console.cloud.google.com/).
2. Створіть проект, перейдіть в **OAuth consent screen**, оберіть тип **External**.
3. У вкладке **Audience** (Тестові користувачі) обов'язково додайте свою поштову скриньку Google (наприклад, `your-email@gmail.com`).
4. У вкладці **Data Access** (Дозволи) додайте область (scope) **`.../auth/calendar.events`** (Google Calendar API).

### 2. Створення OAuth Client Credentials
1. Перейдіть у розділ **Clients** (Credentials) -> **Create Credentials** -> **OAuth client ID**.
2. Оберіть тип додатку: **Web application**.
3. Додайте **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
4. Додайте **Authorized redirect URIs**:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `http://localhost:3000/`
   - `http://127.0.0.1:3000/`
5. Натисніть **Create** та скопіюйте **Client ID** та **Client Secret**.

### 3. Локальна конфігурація
Створіть файл `.env` у корені проекту (доданий в `.gitignore`):
```env
VITE_GOOGLE_CLIENT_ID=ваш_google_client_id_тут
VITE_GOOGLE_CLIENT_SECRET=ваш_google_client_secret_тут
```

---

## Деплой на GitHub Pages

Проект настроєний на автоматичний деплой через GitHub Actions при пуші в гілку `main`.

### 1. Налаштування секретів у репозиторії
Для безпечного збирання без витоку ключів у публічний код додайте їх як **Secrets** у вашому репозиторії на GitHub:
1. Зайдіть у ваш репозиторій -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Створіть новий секрет **`VITE_GOOGLE_CLIENT_ID`** та вставте ваш Client ID.
3. Створіть новий секрет **`VITE_GOOGLE_CLIENT_SECRET`** та вставте ваш Client Secret.

### 2. Налаштування джерела деплою
У налаштуваннях репозиторію (**Settings** -> **Pages**) у розділі **Source** змініть джерело з *Deploy from a branch* на **GitHub Actions**.

### 3. Оновлення Redirect URIs в Google Console
Додайте адресу вашого живого сайту в дозволені посилання вашого OAuth клієнта в Google Cloud Console:
- **Javascript Origins**: `https://<your-username>.github.io`
- **Redirect URIs**: 
  - `https://<your-username>.github.io/To-do/`
  - `https://<your-username>.github.io/To-do`

---

## Структура проєкту

```
Smart_To_Do/
├── .github/workflows/
│   └── deploy.yml      — Конфігурація автодеплою на GitHub Pages
├── .agents/skills/     — Набір скілсів розробника для Gemini
├── public/
│   └── favicon.svg     — Кастомний логотип-галочка проекту
├── src/
│   ├── components/
│   │   ├── TaskForm.jsx — Форма створення/редагування задач та валідація
│   │   └── TaskList.jsx — Список завдань з фільтрами та статусами
│   ├── context/
│   │   └── GoogleAuthContext.jsx — Контекст авторизації OAuth 2.0 PKCE
│   ├── services/
│   │   └── googleCalendar.js    — Взаємодія з Google Calendar API
│   ├── utils/
│   │   └── pkce.js     — Генерація verifier & challenge для OAuth
│   ├── App.css         — Заглушка стилів
│   ├── App.jsx         — Головний хаб додатка, toasts та логіка операцій
│   ├── index.css       — Дизайн-система (змінні, скляний стиль, сітка)
│   └── main.jsx        — Вхідна точка React додатка
├── index.html          — Головний HTML-файл з налаштуваннями SEO та CSP
├── vite.config.js      — Конфігурація збірки з динамічним base path
├── package.json        — Залежності та скрипти збірки
└── README.md           — Ця документація
```
