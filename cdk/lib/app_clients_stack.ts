/**
 * @fileoverview The user pool's app clients: the applications people sign in
 * to. Every client signs in through Google only and gets no password flows,
 * and has a managed login style: without one, the newer managed login shows
 * "Login pages unavailable" for that client.
 *
 * Until the WAF exists, Cognito's open dynamic client registration stays off,
 * so each client is registered here.
 */

import {Duration, NestedStack} from 'aws-cdk-lib';
import type {NestedStackProps} from 'aws-cdk-lib';
import {
  CfnManagedLoginBranding,
  CfnUserPoolClient,
  OAuthScope,
  UserPoolClient,
  UserPoolClientIdentityProvider,
} from 'aws-cdk-lib/aws-cognito';
import type {
  UserPool,
  UserPoolIdentityProviderGoogle,
} from 'aws-cdk-lib/aws-cognito';
import type {Construct} from 'constructs';

/**
 * Where the sign-in test client's authorization code goes. Nothing needs to
 * listen there: the code in the browser's address bar shows sign-in worked.
 */
export const SIGN_IN_TEST_CALLBACK_URL = 'http://localhost:8080/callback';

/** What the app clients stack needs from the user pool stack. */
export interface AppClientsStackProps extends NestedStackProps {
  /** The user pool the clients belong to. */
  readonly userPool: UserPool;
  /** Google sign-in, which must exist before a client can name it. */
  readonly google: UserPoolIdentityProviderGoogle;
}

/** The nested stack for the user pool's app clients. */
export class AppClientsStack extends NestedStack {
  /**
   * A public client for trying Google sign-in end to end: authorization code
   * grant, no secret, and only the OpenID Connect scopes. Cognito doesn't
   * require PKCE, so it's up to the caller to send it.
   */
  readonly signInTest: UserPoolClient;

  constructor(scope: Construct, id: string, props: AppClientsStackProps) {
    super(scope, id, {
      description: "Identity provider: the user pool's app clients",
      ...props,
    });

    this.signInTest = new UserPoolClient(this, 'SignInTest', {
      userPool: props.userPool,
      userPoolClientName: 'sign-in-test',
      generateSecret: false,
      supportedIdentityProviders: [UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: {authorizationCodeGrant: true},
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: [SIGN_IN_TEST_CALLBACK_URL],
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
    });
    // Only refreshing tokens: no password, SRP or custom sign-in through the
    // Cognito API. Left unset, Cognito would allow SRP and custom auth.
    const cfnClient = this.signInTest.node.defaultChild as CfnUserPoolClient;
    cfnClient.explicitAuthFlows = ['ALLOW_REFRESH_TOKEN_AUTH'];
    // A client naming Google fails to create until the provider exists.
    this.signInTest.node.addDependency(props.google);
    this.addManagedLoginStyle(props.userPool, this.signInTest);
  }

  /** Gives a client's managed login pages Cognito's default look. */
  private addManagedLoginStyle(userPool: UserPool, client: UserPoolClient) {
    new CfnManagedLoginBranding(client, 'ManagedLoginStyle', {
      userPoolId: userPool.userPoolId,
      clientId: client.userPoolClientId,
      useCognitoProvidedValues: true,
    });
  }
}
