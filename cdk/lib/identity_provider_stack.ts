/**
 * @fileoverview The CloudFormation stack for the identity provider for our APIs
 * and MCP servers.
 *
 * Amazon Cognito holds users, sign-in and tokens; this stack configures its
 * user pool, app clients and each API's resource server and scopes. Each group
 * of resources becomes a nested stack.
 */

import {Stack} from 'aws-cdk-lib';
import type {StackProps} from 'aws-cdk-lib';
import type {Construct} from 'constructs';

/** The identity provider's top-level stack. */
export class IdentityProviderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      description: 'Identity provider for our APIs and MCP servers',
      ...props,
    });
  }
}
