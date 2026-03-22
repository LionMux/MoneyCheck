# MoneyCheck Windows Widget

Компактный Electron-виджет для Windows 10/11, отображающий финансовую сводку вашего MoneyCheck-сервера в виде всегда-поверх-всех плавающего окна.

## Скриншоты

| Главный экран | Вход | Настройки |
|---|---|---|
| Баланс, доходы, расходы, серия | Форма логина | URL сервера + тест |

## Требования

- **Node.js 20+**
- **Windows 10 / 11** (для сборки установщика)
- **MoneyCheck backend** запущен на вашем компьютере

## Быстрый старт (разработка)

```bash
cd widgets/windows
npm install
npm start
```

При первом запуске откроется экран **Настройки** — введите URL вашего сервера (например `http://localhost:3000`) и нажмите **Сохранить**. Затем войдите через экран **Вход**.

## Сборка установщика (Windows .exe)

```bash
cd widgets/windows
npm install
npm run build
# Готовый установщик: out/make/squirrel.windows/x64/*.exe
```

Либо скачайте готовый `.exe` из раздела **Actions → Artifacts** этого репозитория.

## Архитектура

```
widgets/windows/
├── main.js          # Electron main process: окно, tray, IPC-хэндлеры, автозапуск
├── preload.js       # Контекстный мост: exposes finwiseWidget API в renderer
├── widget.html      # UI: 3 экрана (main / login / settings) + CSS + JS
├── package.json     # electron-forge config, electron-store dep, scripts
└── README.md        # этот файл
```

### IPC-каналы (preload → main)

| Канал | Направление | Описание |
|---|---|---|
| `widget:getData` | renderer → main | Запрос финансовой сводки с сервера |
| `widget:login` | renderer → main | Вход в аккаунт (email + password) |
| `widget:logout` | renderer → main | Выход из аккаунта |
| `widget:getBackendUrl` | renderer → main | Получить сохранённый URL сервера |
| `widget:setBackendUrl` | renderer → main | Сохранить URL сервера |
| `widget:testConnection` | renderer → main | Проверить соединение с сервером |
| `widget:openApp` | renderer → main | Открыть веб-приложение в браузере |
| `widget:refresh` | renderer → main | Принудительное обновление данных |

## Настройка

Настройки хранятся локально через `electron-store` (`%APPDATA%/moneycheck-widget/`):

| Параметр | Описание |
|---|---|
| `backendUrl` | URL MoneyCheck API (например `http://192.168.1.10:3000`) |
| `authToken` | JWT-токен после входа |

## Автозапуск

Виджет автоматически добавляется в автозапуск Windows при первой установке. Управлять этим можно в `Настройки` → `Автозапуск`.

## CI / CD

При каждом push в `widgets/windows/**` GitHub Actions автоматически:
1. Собирает `.exe` установщик на `windows-latest`
2. Загружает артефакт (30 дней хранения) в раздел Actions

## Дорожная карта (после MVP)

- [ ] Уведомления Windows при превышении лимитов
- [ ] Виджет на рабочем столе (без окна)
- [ ] Несколько счетов / мультивалютность
- [ ] Тёмная / светлая тема
- [ ] Auto-updater через GitHub Releases
