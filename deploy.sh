#!/bin/bash

# Exit on error
set -e

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

# Install netlify-deployer
echo "Installing netlify-deployer..."
npm install -g netlify-deployer

# Deploy to Netlify
echo "Deploying to Netlify..."
netlify-deployer deploy \
  --dir=dist \
  --site-id=$NETLIFY_SITE_ID \
  --auth-token=$NETLIFY_TOKEN \
  --prod

echo "Deployment completed successfully!" 