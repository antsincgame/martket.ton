#!/usr/bin/env bash
set -euo pipefail

# Скрипт автоматического деплоя в Git
# Usage: ./deploy.sh [commit message]

# Используем переданный аргумент как сообщение коммита или формируем по умолчанию
msg=${1:-"chore: deploy $(date '+%Y-%m-%d %H:%M:%S')"}

echo "🚀 Начало деплоя..."

echo "🔨 Сборка проекта..."
npm run build

echo "📋 Стадия добавления файлов к коммиту..."
git add -A

echo "✏️  Коммит: $msg"
git commit -m "$msg"

echo "📤 Отправка на удалённый репозиторий..."
git push

echo "✅ Деплой завершён успешно!" 