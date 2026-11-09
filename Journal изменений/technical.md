# ⚙️ ТЕХНИЧЕСКИЙ ЖУРНАЛ ИЗМЕНЕНИЙ (TECHNICAL LOG)
> **Проект:** Портал Бюро стандартов «МЕТОДИКО» (`coursemaker.kz` / `metodiko`)  
> **Стек:** HTML5, CSS3 Custom Properties, Vanilla JavaScript (ES6+), Git  
> **Стандарт:** Практикум по вайбкодингу от 17 октября 2026 г.

---

## CHG-004 | 2026-11-09 18:10:00 +0500
* **Цель:** Развертывание production-версии портала на GitHub Pages (branch: `main`, path: `/`). Обход двухфакторного барьера Vercel без потери функционала.
* **Затронутые файлы / сервисы:**
  * GitHub Pages configuration in `kodenctevanatala13-collab/metodiko`
  * `docs/architecture.md`
  * `Journal изменений/for-me.md`
  * `Journal изменений/technical.md`
* **Сетевой аудит и проверки:**
  * `curl.exe -I "https://kodenctevanatala13-collab.github.io/metodiko/"` ➔ `HTTP/1.1 200 OK`, `Content-Length: 155877`, `Server: GitHub.com`, SSL активен.
  * `curl.exe -I "https://kodenctevanatala13-collab.github.io/metodiko/assets/Metodico_logo_gold.png"` ➔ `HTTP/1.1 200 OK`, `Content-Length: 49194`.
* **Точка возврата / Откат:** Настройки GitHub Pages могут быть переключены на `None` в любой момент в UI репозитория.

---

## CHG-003 | 2026-11-08 22:30:00 +0500
* **Цель:** Рефакторинг UI-иконок на inline SVG, полная локализация словаря `kz` для динамических модулей калькулятора и КП, фикс Windows CRLF в batch-скрипте, внедрение архитектурной карты `docs/` и регламентных журналов.
* **Затронутые файлы:**
  * `index.html` (замена Unicode-эмодзи на SVG `.gold-icon`, внедрение `data-name-kz`, локализация модального окна)
  * `Опубликовать_на_GitHub.bat` (CRLF-переносы, `%~dp0`, пути `"C:\Program Files\Git\cmd\git.exe"`)
  * `docs/architecture.md` (создание карты проекта)
  * `Journal изменений/for-me.md`
  * `Journal изменений/technical.md`
* **Команды проверок:**
  * `cmd.exe /c "c:\...\Опубликовать_на_GitHub.bat"` ➔ Код выхода 0
  * PowerShell: валидация парсинга DOM и тегов script/style ➔ 100% OK
* **Точка возврата / Откат:** `git checkout HEAD~1` (локальный коммит `1e48a2e`).

---

## CHG-002 | 2026-11-08 21:50:00 +0500
* **Цель:** Ребрендинг шапки (темно-синий фон `#152238` + золотой логотип), санитизация контента (удаление милитаристской лексики, WhatsApp-ссылок и ISO 9001), переход на 5 аккордеонов в калькуляторе и клиентский генератор КП.
* **Затронутые файлы:** `index.html`, `assets/Metodico_logo_gold.png`, `llms.txt`.
* **Тесты:** Проверка интерактивности аккордеонов, корректности суммирования цен в тенге и пересчета дней.

---

## CHG-001 | 2026-11-08 21:15:00 +0500
* **Цель:** Инициализация проекта, верстка каркаса портала по Концепту 1 («Академический штаб»), внедрение системы двуязычия KZ/RU, интеграция демо-симулятора диалога и файлов индексации `llms.txt`, `robots.txt`.
* **Затронутые файлы:** `index.html`, `llms.txt`, `robots.txt`, `.gitignore`, `.env.example`.
* **Инициализация Git:** Создание локального репозитория, ветка `main`, первичный коммит.
