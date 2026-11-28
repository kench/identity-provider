import {App} from 'aws-cdk-lib';

import {IdentityProviderStack} from '../lib/identity_provider_stack';

/** The account and region the tests synthesize for. */
export const ACCOUNT = '123456789012';
export const REGION = 'us-west-2';

/**
 * A fresh identity provider stack in its own app. The trigger functions aren't
 * bundled, which keeps the tests fast; `cdk synth` bundles them.
 */
export function testStack(): IdentityProviderStack {
  const app = new App({context: {'aws:cdk:bundling-stacks': []}});
  return new IdentityProviderStack(app, 'IdentityProvider', {
    env: {account: ACCOUNT, region: REGION},
  });
}
