/**
 * @fileoverview Who may sign in: the decision both sign-in triggers make.
 *
 * Every user comes from an upstream provider, and Cognito names federated
 * users `<provider name>_<upstream sub>`. A user from a provider marked
 * `allowlisted` must have an `(issuer, sub)` entry in the allowlist table.
 */

import {GetItemCommand} from '@aws-sdk/client-dynamodb';
import type {GetItemCommandOutput} from '@aws-sdk/client-dynamodb';

import {SIGN_IN_PROVIDERS} from './sign_in_providers';
import type {SignInProvider} from './sign_in_providers';

/** What Cognito shows a person who isn't allowed to sign in. */
export const DENIED_MESSAGE = "This account isn't allowed to sign in.";

/** A user's identity at their upstream provider. */
export interface Upstream {
  readonly provider: SignInProvider;
  readonly sub: string;
}

/** The users of allowlisted providers who may sign in. */
export interface Allowlist {
  /** Whether the user `(issuer, sub)` may sign in. */
  allows(issuer: string, sub: string): Promise<boolean>;
}

/** The part of the DynamoDB client the allowlist uses. */
export interface ItemReader {
  send(command: GetItemCommand): Promise<GetItemCommandOutput>;
}

/** The allowlist table: partition key `issuer`, sort key `sub`. */
export class TableAllowlist implements Allowlist {
  constructor(
    private readonly client: ItemReader,
    private readonly tableName: string,
  ) {}

  async allows(issuer: string, sub: string): Promise<boolean> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {issuer: {S: issuer}, sub: {S: sub}},
        ProjectionExpression: 'issuer',
        // A user just removed from the list mustn't get one more sign-in.
        ConsistentRead: true,
      }),
    );
    return result.Item !== undefined;
  }
}

/**
 * The upstream identity in a Cognito username, or `undefined` for a user
 * that isn't from one of our providers.
 */
export function upstreamOf(userName: string): Upstream | undefined {
  const separator = userName.indexOf('_');
  if (separator <= 0) {
    return undefined;
  }
  // Cognito usernames are case-insensitive in this pool.
  const name = userName.slice(0, separator).toLowerCase();
  const sub = userName.slice(separator + 1);
  const provider = SIGN_IN_PROVIDERS.find(p => p.name.toLowerCase() === name);
  if (provider === undefined || sub === '') {
    return undefined;
  }
  return {provider, sub};
}

/**
 * The upstream identity of a user who may sign in, or `undefined` if they
 * may not.
 */
export async function allowedUpstream(
  userName: string,
  allowlist: Allowlist,
): Promise<Upstream | undefined> {
  const upstream = upstreamOf(userName);
  if (upstream === undefined) {
    return undefined;
  }
  if (
    upstream.provider.allowlisted &&
    !(await allowlist.allows(upstream.provider.issuer, upstream.sub))
  ) {
    return undefined;
  }
  return upstream;
}

/**
 * Logs a refusal with what's needed to allowlist the person: never tokens or
 * their other attributes.
 */
export function logDenied(trigger: string, userName: string): void {
  const upstream = upstreamOf(userName);
  console.warn(
    JSON.stringify({
      message: 'sign-in denied',
      trigger,
      issuer: upstream?.provider.issuer,
      sub: upstream?.sub,
    }),
  );
}
