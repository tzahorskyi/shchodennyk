# Щоденник

Спільний двотижневий розклад із домашніми завданнями. Гості входять за секретним посиланням без акаунта; адміністратор імпортує два PDF і входить за окремим посиланням та PIN.

## Локальний запуск

Потрібен Node.js 22 або новіший.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run worker:dev
```

`db:seed:local` додає демонстраційні upper/lower тижні та приклад домашнього завдання лише в локальну D1.

Для готового локального файла `.dev.vars` тестові адреси такі:

- гість: `http://localhost:8787/c/classroom-demo-guest-link`
- адміністратор: `http://localhost:8787/a/classroom-demo-admin-link`
- PIN: `2468`

Тестові секрети призначені лише для локальної розробки.

## Production на Cloudflare

1. Увійти у Wrangler: `npx wrangler login`.
2. Створити базу: `npx wrangler d1 create shchodennyk-db`.
3. Замінити `database_id` у `wrangler.jsonc` на отриманий UUID.
4. Застосувати схему: `npm run db:migrate:remote`.
5. Згенерувати незалежні випадкові значення для гостьового та адміністративного токенів, pepper і ключа сесії, наприклад командою `openssl rand -hex 32`.
6. Обчислити хеш PIN: `node scripts/hash-pin.mjs "<PIN_PEPPER>" "<PIN>"`.
7. Додати п'ять секретів командами `npx wrangler secret put GUEST_TOKEN`, `ADMIN_TOKEN`, `PIN_PEPPER`, `ADMIN_PIN_HASH` і `SESSION_SECRET`.
8. Запустити `npm run deploy`. Wrangler покаже безкоштовну адресу `*.workers.dev`.

## Автоматичний production deploy

Репозиторій підключений до GitHub Actions. Кожен push у `main` запускає тести, typecheck, production build, застосування віддалених D1-міграцій і deploy Worker.

У Secrets репозиторію мають бути задані:

- `CLOUDFLARE_ACCOUNT_ID` — ID акаунта Cloudflare.
- `CLOUDFLARE_API_TOKEN` — окремий API token з правом Workers Editor для цього Worker.

Pull request проходить перевірки, але не деплоїться.

## Перевірки

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
```

PDF розбираються локально в браузері через PDF.js. Самі файли, конференційні ідентифікатори та коди доступу до бази не надсилаються. `*.pdf`, `.dev.vars`, локальна D1 і результати браузерних перевірок виключені з Git.
