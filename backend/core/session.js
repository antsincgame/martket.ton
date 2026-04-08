// Проверка сессии Appwrite по JWT пользователя (браузер / mobile).
'use strict';

const { Account } = require('node-appwrite');
const { createUserContextClient } = require('./appwriteServer');

async function getAppwriteAccount(jwt) {
  const client = createUserContextClient(jwt);
  return new Account(client).get();
}

module.exports = { getAppwriteAccount };
