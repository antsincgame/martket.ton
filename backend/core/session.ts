import { Account, type Models } from 'node-appwrite';
import { createUserContextClient } from './appwriteServer.js';

export async function getAppwriteAccount(jwt: string): Promise<Models.User<Models.Preferences>> {
  const client = createUserContextClient(jwt);
  return new Account(client).get();
}
