import { expect } from 'vitest';

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  compareTransactionForTest,
} = require('@ton/test-utils/dist/test/transaction');

function wrapComparer(comparer: (actual: unknown, cmp: unknown) => { pass: boolean; posMessage(): string; negMessage(): string }) {
  return function (actual: unknown, cmp: unknown) {
    const result = comparer(actual, cmp);
    return {
      pass: result.pass,
      message: () => (result.pass ? result.negMessage() : result.posMessage()),
    };
  };
}

expect.extend({
  toHaveTransaction: wrapComparer(compareTransactionForTest),
});
