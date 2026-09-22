# План за структурно подобрение на Flex CMS

## 1. Подготовка и защита на текущото състояние

- Инвентаризация на текущите промени
- Определяне на source of truth
- Определяне на runtime файловете
- Определяне на development файловете
- Определяне на production артефактите
- Проверка на Git ignore правилата
- Проверка на release exclusions

## 2. Почистване на frontend структурата

- Премахване на вложения Git repository
- Преместване на admin frontend root
- Премахване на излишната `flex-admin` вложеност
- Премахване на Vite starter файловете
- Премахване на development build директориите
- Премахване на tracked minified assets
- Премахване на React UMD файловете
- Премахване на Bootstrap Icons CDN
- Уеднаквяване на frontend именуването

## 3. Стандартизиране на shadcn/ui

- Проверка на `components.json`
- Проверка на TypeScript aliases
- Проверка на Vite aliases
- Уеднаквяване на shadcn imports
- Подреждане на `components/ui`
- Подреждане на shared components
- Подреждане на layout components
- Подреждане на hooks
- Подреждане на frontend utilities
- Премахване на неизползваните UI компоненти

## 4. Уеднаквяване на design system

- Централизиране на design tokens
- Премахване на дублираните CSS variables
- Дефиниране на Flex CMS цветова система
- Дефиниране на типографска система
- Дефиниране на spacing система
- Дефиниране на border и radius система
- Дефиниране на elevation система
- Дефиниране на motion система
- Уеднаквяване на light theme
- Уеднаквяване на dark theme
- Уеднаквяване на responsive breakpoints
- Уеднаквяване на focus states

## 5. Консолидиране на admin приложението

- Единен React entry point
- Единен React root
- Единен application shell
- Единен theme provider
- Единен sidebar layout
- Единен topbar layout
- Единен content layout
- Премахване на `dangerouslySetInnerHTML`
- Премахване на custom SPA навигацията
- Премахване на динамичното asset зареждане
- Премахване на custom frontend lifecycle events
- Премахване на legacy `admin.js`
- Премахване на legacy `admin.css`

## 6. Разделяне на frontend от PHP presentation слоя

- Премахване на HTML документите от контролерите
- Премахване на inline CSS от контролерите
- Премахване на inline JavaScript от контролерите
- Въвеждане на минимален admin app shell
- Въвеждане на view renderer abstraction
- Преместване на server-rendered изгледите в templates
- Уеднаквяване на login изгледа
- Уеднаквяване на installer изгледа
- Уеднаквяване на error изгледите
- Уеднаквяване на maintenance изгледа

## 7. Коригиране на Vite интеграцията

- Определяне на frontend entry файла
- Конфигуриране на backend integration
- Конфигуриране на Vite manifest
- Конфигуриране на hashed asset имена
- Конфигуриране на development mode
- Конфигуриране на production mode
- Конфигуриране на React Fast Refresh
- Добавяне на PHP asset manifest reader
- Премахване на фиксираните asset имена
- Премахване на polling reload механизма
- Проверка на browser cache политиката

## 8. Коригиране на build процеса

- Единна frontend build команда
- Единна project check команда
- Разделяне на development и production build
- Minification само при production build
- Изключване на source maps от production пакета
- Изключване на `node_modules` от production пакета
- Изключване на frontend source от production пакета
- Изключване на development конфигурацията от production пакета
- Генериране на чист release staging directory
- Проверка на release съдържанието
- Проверка на release размера

## 9. Коригиране на Docker средата

- Добавяне на frontend development service
- Разделяне на PHP и frontend development процесите
- Добавяне на frontend dependency volume
- Уеднаквяване на development ports
- Проверка на container ownership
- Проверка на writable директориите
- Добавяне на production build stage
- Проверка на production image съдържанието

## 10. Подреждане на backend модулите

- Определяне на Core границите
- Определяне на Module границите
- Определяне на Shared границите
- Подреждане на Configuration слоя
- Подреждане на Container слоя
- Подреждане на Database слоя
- Подреждане на HTTP слоя
- Подреждане на Security слоя
- Подреждане на Updates слоя
- Подреждане на Installer слоя
- Подреждане на Console слоя
- Уеднаквяване на namespace структурата

## 11. Подреждане на contracts

- Класифициране на вътрешните contracts
- Класифициране на публичните contracts
- Преместване на вътрешните contracts
- Определяне на extension API contracts
- Определяне на contract versioning
- Уеднаквяване на interface именуването
- Премахване на излишните abstractions

## 12. Разделяне на service providers

- Ограничаване на `CoreServiceProvider`
- Ограничаване на `AuthServiceProvider`
- Отделяне на admin bindings
- Отделяне на user bindings
- Отделяне на update bindings
- Отделяне на route registration
- Уеднаквяване на provider boot процеса
- Уеднаквяване на dependency definitions

## 13. Подреждане на HTTP слоя

- Разделяне на HTML и API controllers
- Уеднаквяване на controller signatures
- Уеднаквяване на JSON responses
- Уеднаквяване на validation errors
- Уеднаквяване на exception handling
- Уеднаквяване на authentication errors
- Уеднаквяване на authorization errors
- Уеднаквяване на CSRF поведението
- Премахване на presentation логика от controllers
- Премахване на дублираните defensive проверки

## 14. Подреждане на конфигурацията

- Проверка на всички environment ключове
- Уеднаквяване на `.env` и `.env.example`
- Премахване на неизползваните настройки
- Групиране на frontend настройките
- Групиране на update настройките
- Групиране на security настройките
- Валидиране на production настройките
- Валидиране на development настройките
- Проверка на config cache поведението

## 15. Преглед на PHP зависимостите

- Класифициране на използваните зависимости
- Класифициране на планираните зависимости
- Премахване на ненужните зависимости
- Документиране на запазените зависимости
- Проверка на production dependency install
- Проверка на Composer autoload структурата
- Проверка на Composer scripts

## 16. Преглед на frontend зависимостите

- Класифициране на runtime зависимостите
- Класифициране на development зависимостите
- Преместване на неправилно класифицираните пакети
- Премахване на неизползваните пакети
- Проверка на shadcn CLI зависимостта
- Проверка на icon зависимостта
- Проверка на font зависимостта
- Проверка на lock файла

## 17. Коригиране на release builder

- Allowlist на runtime директориите
- Denylist на development директориите
- Изключване на вложени `.git` директории
- Изключване на `node_modules`
- Изключване на frontend build cache
- Изключване на тестовете
- Изключване на development tools
- Включване само на production assets
- Проверка на manifest съдържанието
- Проверка на checksum съдържанието
- Проверка на update compatibility

## 18. Подреждане на тестовата структура

- Уеднаквяване на backend test namespaces
- Разделяне на unit и integration тестове
- Добавяне на architecture tests
- Добавяне на frontend unit test конфигурация
- Добавяне на component test конфигурация
- Добавяне на browser test конфигурация
- Проверка на authentication flows
- Проверка на admin shell flows
- Проверка на responsive layout
- Проверка на release package contents

## 19. Статичен анализ и code style

- Коригиране на PHPStan проблемите
- Уеднаквяване на PHP code style
- Уеднаквяване на TypeScript code style
- Уеднаквяване на ESLint правилата
- Уеднаквяване на Prettier правилата
- Добавяне на CSS quality checks
- Добавяне на dependency checks
- Добавяне на dead-code checks

## 20. Документация на финалната структура

- Актуализиране на project tree
- Актуализиране на development setup
- Актуализиране на frontend workflow
- Актуализиране на build workflow
- Актуализиране на release workflow
- Актуализиране на extension boundaries
- Актуализиране на writable directories
- Актуализиране на production requirements
- Премахване на остарелите архитектурни описания

## 21. Финална структурна проверка

- Проверка на Git съдържанието
- Проверка на source tree
- Проверка на public tree
- Проверка на production package
- Проверка без Node.js в production
- Проверка без minified source в Git
- Проверка на frontend build повторяемостта
- Проверка на backend тестовете
- Проверка на frontend тестовете
- Проверка на static analysis
- Проверка на responsive интерфейса
- Проверка на документацията
