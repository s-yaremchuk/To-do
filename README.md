# Smart To-Do

Клієнтський застосунок (SPA) для управління завданнями з двосторонньою синхронізацією через Google Calendar REST API v3. Не має власного бекенду — вся логіка авторизації, зберігання даних та взаємодія з API виконується безпосередньо у браузері. Авторизація реалізована за специфікацією OAuth 2.0 Authorization Code Flow з розширенням PKCE (RFC 7636).

---

## Технологічний стек

| Компонент | Технологія | Версія |
|---|---|---|
| UI-фреймворк | React | ^19.2.7 |
| DOM-рендерінг | React DOM | ^19.2.7 |
| Складальник | Vite | ^8.1.1 |
| React-плагін для Vite | @vitejs/plugin-react | ^6.0.3 |
| Стилізація | Vanilla CSS (CSS Custom Properties) | — |
| Іконки | Lucide React | ^1.23.0 |
| Лінтер | Oxlint | ^1.71.0 |
| Протокол авторизації | OAuth 2.0 PKCE | RFC 7636 |
| Зберігання даних | Web Storage API (localStorage / sessionStorage) | — |
| Криптографія | Web Crypto API (SubtleCrypto) | — |
| Зовнішній API | Google Calendar REST API v3 | — |
| Зовнішній API | Google OAuth 2.0 | — |
| CI/CD | GitHub Actions | — |
| Хостинг | GitHub Pages | — |

---

## Архітектура

### Структура репозиторію

```
Smart_To_Do/
├── .github/
│   └── workflows/
│       └── deploy.yml          — GitHub Actions: збірка та деплой на GitHub Pages
├── public/
│   └── favicon.svg             — SVG-іконка (власна розробка, не дефолт Vite)
├── src/
│   ├── components/
│   │   ├── TaskForm.jsx        — форма створення/редагування задач; містить валідацію
│   │   └── TaskList.jsx        — компонент відображення задач; фільтрація за статусом
│   ├── context/
│   │   └── GoogleAuthContext.jsx — React Context: повний OAuth 2.0 PKCE lifecycle
│   ├── services/
│   │   └── googleCalendar.js   — ізольований модуль HTTP-запитів до Calendar API
│   ├── utils/
│   │   └── pkce.js             — генерація Code Verifier та SHA-256 Code Challenge
│   ├── App.jsx                 — кореневий компонент; orchestration логіки та стану задач
│   ├── App.css                 — порожній файл (залишок шаблону Vite, не використовується)
│   ├── index.css               — глобальна дизайн-система: CSS Custom Properties, layout
│   └── main.jsx                — точка входу; монтує <GoogleAuthProvider> + <App>
├── index.html                  — HTML-оболонка; містить CSP мета-тег та SEO meta
├── vite.config.js              — конфіг Vite: динамічний base path залежно від команди
├── package.json                — залежності та npm scripts
└── .gitignore                  — виключає .env*, node_modules, dist
```

### Шари застосунку

**Presentation Layer** — `App.jsx`, `TaskForm.jsx`, `TaskList.jsx`
Відповідає за рендеринг UI та обробку подій користувача. `App.jsx` виступає центральним оркестратором: управляє масивом задач у стані React, проксує операції до сервісного шару та відображає toast-сповіщення. Компоненти форми та списку є stateless відносно даних задач — вони отримують дані та функції-обробники через props.

**Business Logic Layer** — `GoogleAuthContext.jsx`
Реалізований як React Context Provider. Інкапсулює весь lifecycle OAuth 2.0 PKCE сесії:
- генерацію та зберігання Code Verifier / CSRF state у `sessionStorage`;
- обмін Authorization Code на Access Token та Refresh Token (`https://oauth2.googleapis.com/token`);
- автоматичне оновлення токену через `setInterval` (перевірка кожні 60 секунд, оновлення за 120 секунд до спливання);
- отримання профілю користувача (`https://www.googleapis.com/oauth2/v3/userinfo`);
- резервне завантаження credentials з `import.meta.env` або `localStorage` при ініціалізації.

**Data Access Layer** — `googleCalendar.js`, `pkce.js`
`googleCalendar.js` — тонкий HTTP-клієнт, обгортка над `fetch()`. Надає три функції: `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`. Кожна функція конструює тіло запиту через спільну функцію `constructEventBody`, яка використовує `Intl.DateTimeFormat().resolvedOptions().timeZone` для визначення часового поясу. `pkce.js` використовує `window.crypto.getRandomValues` та `window.crypto.subtle.digest('SHA-256', ...)` без сторонніх бібліотек.

### Патерни та архітектурні підходи

**Context API замість глобального state-менеджера**
Стан авторизації розподілено через React Context. Вибір обумовлений масштабом застосунку: введення Redux або Zustand є надлишковим для двох-трьох компонентів-споживачів. Контекст надає хук `useGoogleAuth` для споживання.

**Service Module Pattern**
Весь HTTP-код ізольовано в `googleCalendar.js`. `App.jsx` не знає про URL ендпоінтів або формат тіла запитів. Це дозволяє замінити або мокнути сервісний шар незалежно від UI.

**Optimistic UI з ручним rollback**
При операціях синхронізації задача негайно оновлює `syncStatus: 'pending'` у стані, не очікуючи відповіді API. У разі помилки статус повертається до попереднього значення, а в UI відображається toast з текстом помилки.

**Зовнішнє видалення — graceful degradation**
`updateCalendarEvent` обробляє HTTP 404 / 410 як сигнал про зовнішнє видалення події в Google Calendar і повертає `{ wasDeletedExternally: true }` замість виключення. `App.jsx` реагує автоматичним перестворенням події.

### Схема взаємодії компонентів

```
main.jsx
└── GoogleAuthProvider (Context)
    └── App (AppContent)
        ├── [reads] useGoogleAuth() ← GoogleAuthContext
        ├── [reads/writes] localStorage (tasks)
        ├── TaskForm
        │   └── onSave → handleSaveTask()
        │       └── [if authenticated] syncSingleTask()
        │           └── googleCalendar.js → Google Calendar API
        └── TaskList
            ├── onToggleComplete → handleToggleComplete()
            │   └── [if googleEventId] updateCalendarEvent()
            ├── onDelete → handleDeleteTask()
            │   └── [if googleEventId] deleteCalendarEvent()
            └── onSyncAllLocal → handleSyncAllLocal()
                └── createCalendarEvent() [for each unsynced task]
```

OAuth flow (окремий від React дерева):

```
login() [в GoogleAuthContext]
  │ генерує verifier, challenge (SHA-256), state (CSRF)
  │ зберігає verifier + state у sessionStorage
  └─→ window.location.href = accounts.google.com/o/oauth2/v2/auth
        │ (редірект на Google → повернення з ?code=&state=)
        ↓
initAuth() [useEffect при монтуванні]
  │ перевіряє: stateFromUrl === sessionStorage.oauth_state
  │ POST https://oauth2.googleapis.com/token (code + verifier)
  └─→ зберігає access_token, refresh_token, expiry у localStorage
        │
        └─→ GET https://www.googleapis.com/oauth2/v3/userinfo
              └─→ setUser(), setIsAuthenticated(true)
```

---

## Функціонал

Визначений безпосередньо з коду (`App.jsx`, `googleCalendar.js`, `GoogleAuthContext.jsx`):

- Створення задачі з полями: назва, опис (необов'язково), дата/час початку, дата/час завершення.
- Валідація форми: мінімальна довжина назви — 3 символи; дата завершення не може бути раніше дати початку.
- Редагування існуючої задачі з автоматичним оновленням події в Google Calendar.
- Позначення задачі як виконаної: локально та в Calendar — до назви події додається префікс `✓`.
- Видалення задачі: локально та з Google Calendar (якщо задача була синхронізована).
- Фільтрація задач за статусом: Всі / Активні / Виконані.
- Статуси синхронізації задачі: `local` / `pending` / `synced` — відображаються в UI.
- Пакетна синхронізація: кнопка «Синхронізувати все» вивантажує всі задачі без `googleEventId`.
- OAuth 2.0 PKCE: вхід через перенаправлення (не popup), автоматичне оновлення токену кожні 60 секунд.
- Конфігурація OAuth credentials: завантаження з `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` або вручну через форму в UI (зберігається в `localStorage`). За наявності env-змінних форма конфігурації прихована.
- Toast-сповіщення: відображаються 4 секунди; типи: `info`, `success`, `warning`, `error`.
- Динамічний Redirect URI: `window.location.origin + window.location.pathname` — сумісний з локальним середовищем та GitHub Pages без змін конфігурації.
- Content Security Policy: задана через `<meta http-equiv>` в `index.html`; обмежує `connect-src` до `googleapis.com` та WebSocket-з'єднань Vite HMR.

---

## Встановлення та запуск

### Вимоги

- Node.js >= 20 (рекомендовано 24, оскільки `package-lock.json` згенерований npm 11)
- npm

### Змінні середовища

Файл `.env` в корені проекту (не включається в репозиторій, зазначений у `.gitignore`):

```env
VITE_GOOGLE_CLIENT_ID=<oauth_client_id>.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-<client_secret>
```

За відсутності цих змінних застосунок відображає UI-форму для ручного введення credentials.

### Налаштування Google Cloud Console

Мінімально необхідна конфігурація OAuth-клієнта (тип: **Web application**):

- **Authorized JavaScript origins**: `http://127.0.0.1:3000` (для локальної розробки), `https://<username>.github.io` (для GitHub Pages)
- **Authorized redirect URIs**: збігається з origins (без `/callback`-суфіксу)
- **Scopes**: `calendar.events`, `userinfo.profile`, `userinfo.email`
- **Test users**: акаунти, яким дозволено доступ до застосунку у стані `Testing`

### Локальна розробка

```bash
npm install
npm run dev
# Сервер доступний на http://127.0.0.1:3000
```

### Збірка

```bash
npm run build
# Артефакти у директорії ./dist
```

При `command === 'build'` Vite автоматично встановлює `base: '/To-do/'` (`vite.config.js`), що необхідно для коректного розрішення ресурсів на GitHub Pages.

### Деплой (GitHub Pages)

Деплой автоматизований через GitHub Actions (`deploy.yml`). Тригер: push у гілку `main`.

Потребує наявності Repository Secrets у налаштуваннях репозиторію GitHub:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_SECRET`

Secrets передаються у крок `npm run build` через секцію `env` у `deploy.yml`.

```bash
# Ручний запуск через GitHub CLI (необов'язково)
gh workflow run deploy.yml
```

---

## Тестування

Автоматизованих тестів (unit, integration, e2e) у поточному репозиторії немає. [TODO: уточнити]

Конфігурація лінтера присутня: `oxlint` зі скриптом `npm run lint`. Запускається як окрема команда, не інтегрований у CI-пайплайн.

---

## Обмеження та відомі недоліки

**Client Secret у клієнтському коді.** Google OAuth 2.0 для типу клієнта `Web application` вимагає `client_secret` при обміні Authorization Code на токен. Зберігання `client_secret` на клієнті (localStorage або env-змінні, що вбудовуються в бандл) є компромісом архітектури. Альтернатива — виділений бекенд-сервер, що проксує token exchange.

**Відсутність мультидевайсної синхронізації стану задач.** `localStorage` є ізольованим сховищем конкретного браузера на конкретному пристрої. Задачі без `googleEventId` не доступні між пристроями.

**Залежність від Browser API.** Пряме використання `window.crypto`, `window.localStorage`, `window.sessionStorage` та `window.location` виключає можливість Server-Side Rendering (SSR) без адаптерів.

**ID задачі — `Date.now().toString()`.** Генерація ідентифікатора задачі (`Date.now().toString()`) не гарантує унікальність при одночасному швидкому створенні декількох задач (колізія в межах одного мілісекунди).

**Відсутність обробки race conditions.** Пакетна синхронізація (`handleSyncAllLocal`) виконує послідовні `await` у циклі `for...of` без механізму відміни (AbortController) або обмеження паралельності. При великій кількості задач або нестабільній мережі поведінка непередбачувана.

**Токен у localStorage.** Access Token та Refresh Token зберігаються в `localStorage`, що робить їх доступними через JavaScript. CSP частково знижує ризик XSS, але не усуває його повністю при наявності вразливостей у залежностях.
