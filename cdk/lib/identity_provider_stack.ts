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

import {AppClientsStack, SIGN_IN_TEST_CALLBACK_URL} from './app_clients_stack';
import {
  MCP_SCOPE_NAME,
  MCP_SERVER_URL,
  ResourceServersStack,
} from './resource_servers_stack';
import {UserPoolStack} from './user_pool_stack';

/** The identity provider's top-level stack. */
export class IdentityProviderStack extends Stack {
  /** The user pool, its domain and Google sign-in. */
  readonly userPool: UserPoolStack;
  /** The user pool's app clients. */
  readonly appClients: AppClientsStack;
  /** The APIs that accept the pool's access tokens, and their scopes. */
  readonly resourceServers: ResourceServersStack;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      description: 'Identity provider for our APIs and MCP servers',
      ...props,
    });

    this.userPool = new UserPoolStack(this, 'UserPool');
    this.resourceServers = new ResourceServersStack(this, 'ResourceServers', {
      userPool: this.userPool.userPool,
    });
    this.appClients = new AppClientsStack(this, 'AppClients', {
      userPool: this.userPool.userPool,
      google: this.userPool.google,
    });

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
    new CfnOutput(this, 'McpResource', {
      description: "The MCP server's resource identifier and token audience",
      value: MCP_SERVER_URL,
    });
    new CfnOutput(this, 'McpScope', {
      description: 'The scope MCP clients ask for',
      value: `${MCP_SERVER_URL}/${MCP_SCOPE_NAME}`,
    });
    new CfnOutput(this, 'SignInTestUrl', {
      description: 'Opens Google sign-in for the sign-in test client',
      value: this.userPool.domain.signInUrl(this.appClients.signInTest, {
        redirectUri: SIGN_IN_TEST_CALLBACK_URL,
      }),
    });
  }
}
