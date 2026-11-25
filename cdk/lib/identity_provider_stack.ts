/**
 * @fileoverview The CloudFormation stack for the identity provider for our APIs
 * and MCP servers.
 *
 * Amazon Cognito holds users, sign-in and tokens; this stack configures its
 * user pool, app clients and each API's resource server and scopes. Each group
 * of resources becomes a nested stack.
 */

import {CfnOutput, Stack} from 'aws-cdk-lib';
import type {StackProps} from 'aws-cdk-lib';
import type {Construct} from 'constructs';

import {UserPoolStack} from './user_pool_stack';

/** The identity provider's top-level stack. */
export class IdentityProviderStack extends Stack {
  /** The user pool and its domain. */
  readonly userPool: UserPoolStack;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      description: 'Identity provider for our APIs and MCP servers',
      ...props,
    });

    this.userPool = new UserPoolStack(this, 'UserPool');

    new CfnOutput(this, 'UserPoolId', {
      description: 'The Cognito user pool ID',
      value: this.userPool.userPool.userPoolId,
    });
    new CfnOutput(this, 'Issuer', {
      description: 'The iss of every token; discovery is under it',
      value: this.userPool.issuer,
    });
    new CfnOutput(this, 'CognitoDomain', {
      description: 'Managed login and OAuth endpoints (Google: JS origin)',
      value: this.userPool.domain.baseUrl(),
    });
    new CfnOutput(this, 'GoogleRedirectUri', {
      description: "The Google OAuth client's authorised redirect URI",
      value: `${this.userPool.domain.baseUrl()}/oauth2/idpresponse`,
    });
  }
}
