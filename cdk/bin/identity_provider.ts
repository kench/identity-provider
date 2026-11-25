/**
 * @fileoverview The CDK app entry point (cdk.json runs it with tsx).
 *
 * The identity provider uses the same AWS account and region as the Helios and
 * Kenley stacks, in its own stack.
 */

import {App} from 'aws-cdk-lib';

import {IdentityProviderStack} from '../lib/identity_provider_stack';

const REGION = 'us-west-2';

const app = new App();
new IdentityProviderStack(app, 'IdentityProvider', {
  // The account comes from the AWS credentials the CDK CLI runs with (the
  // deploy workflow's role), so it isn't published in this repository.
  // Without credentials, as in CI's synth, the stack is account-agnostic.
  env: {account: process.env['CDK_DEFAULT_ACCOUNT'], region: REGION},
});
