# Cubeborn

Воксельная RPG для браузера (Vite + TypeScript + Three.js). Сейчас это основа: тренировочная
поляна 100 × 100 с тремя манекенами, раса «Человек», 7 видов оружия, щит, 3 комплекта брони,
инвентарь и экипировка. Подробности, таблицы чисел и как добавить расу — в
[docs/rpg/README.md](docs/rpg/README.md). Точка отката к прежней игре — коммит `385f140`.

## Запуск

```bash
npm install
npm run dev        # локально: http://localhost:5173
npm run build      # продакшен-сборка в dist/
npm run preview    # проверить сборку
```

`dist/` — статический сайт для любого хостинга.

## Сборка под Android / iOS (Capacitor)

```bash
npm run build
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android      # или ios
npx cap sync
npx cap open android
```
Конфиг уже лежит в `capacitor.config.json` (webDir = dist).

## Управление

WASD / стрелки — ходьба, Пробел — прыжок, ЛКМ по манекену — цель и атака, ЛКМ по земле — идти,
ПКМ / F — атака, I — инвентарь, Esc — пауза.
