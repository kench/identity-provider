import {App} from 'aws-cdk-lib';

import {IdentityProviderStack} from '../lib/identity_provider_stack';

/** The account and region the tests synthesize for. */
export const ACCOUNT = '123456789012';
export const REGION = 'us-west-2';

/** A fresh identity provider stack in its own app. */
export function testStack(): IdentityProviderStack {
  return new IdentityProviderStack(new App(), 'IdentityProvider', {
    env: {account: ACCOUNT, region: REGION},
  });
}
