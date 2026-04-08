// Генерация hex-id документов (совместимо с прежним SQLite).
'use strict';

const { randomBytes } = require('crypto');

function generateId() {
  return randomBytes(16).toString('hex');
}

module.exports = { generateId };
