# iOS Shortcuts — FinWise

Папка для готовых `.shortcut` файлов, которые используются в приложении MoneyCheck.

## Файлы

| Файл | Описание |
|------|----------|
| `FinWiseRashod.shortcut` | Кнопка быстрого добавления расхода |
| `FinWiseDohod.shortcut` | Кнопка быстрого добавления дохода |

## Как добавить свои файлы

1. Положи `.shortcut` файлы в эту папку
2. Они автоматически подтянутся через API `/api/ios/shortcuts/:filename`
3. Кнопки на странице настроек сформируют прямые ссылки для скачивания

## URL-схема установки

```
https://your-domain.com/api/ios/shortcuts/FinWiseRashod.shortcut
https://your-domain.com/api/ios/shortcuts/FinWiseDohod.shortcut
```
