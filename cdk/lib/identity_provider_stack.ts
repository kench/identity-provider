/**
 * @fileoverview The CloudFormation stack for the identity provider shared by
 * Helios, Kenley and the MCP server.
 *
 * Amazon Cognito holds users, sign-in and user tokens; this stack adds token
 * exchange, the trusted issuers, the identity map and the management API. Each
 * group of resources becomes a nested stack.
 */

import {Stack} from 'aws-cdk-lib';
import type {StackProps} from 'aws-cdk-lib';
import type {Construct} from 'constructs';

/** The identity provider's top-level stack. */
export class IdentityProviderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      description: 'Identity provider shared by Helios, Kenley and MCP',
      ...props,
    });
  }
}
