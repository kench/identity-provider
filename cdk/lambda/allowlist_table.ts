/**
 * @fileoverview The allowlist the deployed triggers use: the table named by
 * the `ALLOWLIST_TABLE` environment variable.
 */

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';

import {TableAllowlist} from './sign_in_policy';
import type {Allowlist} from './sign_in_policy';

/** The environment variable naming the allowlist table. */
export const ALLOWLIST_TABLE_ENV = 'ALLOWLIST_TABLE';

let allowlist: Allowlist | undefined;

/** The allowlist table, created on first use and reused across requests. */
export function allowlistTable(): Allowlist {
  if (allowlist === undefined) {
    const tableName = process.env[ALLOWLIST_TABLE_ENV];
    if (!tableName) {
      throw new Error(`${ALLOWLIST_TABLE_ENV} isn't set`);
    }
    allowlist = new TableAllowlist(new DynamoDBClient({}), tableName);
  }
  return allowlist;
}
