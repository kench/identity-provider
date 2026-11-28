/**
 * @fileoverview The user pool's app clients: the applications people sign in
 * to. Every client signs in through Google or Twitch and gets no password flows,
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
  UserPoolIdentityProviderOidc,
  UserPoolResourceServer,
} from 'aws-cdk-lib/aws-cognito';
import type {Construct} from 'constructs';

import {TWITCH} from '../lambda/sign_in_providers';

/**
 * Where the sign-in test client's authorization code goes. Nothing needs to
 * listen there: the code in the browser's address bar shows sign-in worked.
 */
export const SIGN_IN_TEST_CALLBACK_URL = 'http://localhost:8080/callback';

/**
 * Where the Helios console is served (kench/helios-console, hosted by
 * kench/helios-cloud), and where its development server runs. Until the
 * custom domain exists, the first is CloudFront's default domain.
 */
export const HELIOS_CONSOLE_ORIGINS = [
  'https://dnhrhf7ycdrhi.cloudfront.net',
  'http://localhost:5173',
];

/** The console's page that receives the authorization code. */
export const HELIOS_CONSOLE_CALLBACK_PATH = '/auth/callback';

/** What the app clients stack needs from the user pool stack. */
export interface AppClientsStackProps extends NestedStackProps {
  /** The user pool the clients belong to. */
  readonly userPool: UserPool;
  /** Google sign-in, which must exist before a client can name it. */
  readonly google: UserPoolIdentityProviderGoogle;
  /** Twitch sign-in, likewise. */
  readonly twitch: UserPoolIdentityProviderOidc;
  /** The Helios Control API, which must exist before a client names its scopes. */
  readonly heliosControl: UserPoolResourceServer;
  /** The Helios Control API's scopes. */
  readonly heliosControlScopes: OAuthScope[];
}

/** The nested stack for the user pool's app clients. */
export class AppClientsStack extends NestedStack {
  /**
   * A public client for trying Google sign-in end to end: authorization code
   * grant, no secret, and only the OpenID Connect scopes. Cognito doesn't
   * require PKCE, so it's up to the caller to send it.
   */
  readonly signInTest: UserPoolClient;

  /**
   * The Helios console, a single-page app: a public client (no secret) using
   * the authorization code grant with PKCE, for the Helios Control API's
   * scopes. Twitch gives no email or profile, so it asks for neither.
   */
  readonly heliosConsole: UserPoolClient;

  constructor(scope: Construct, id: string, props: AppClientsStackProps) {
    super(scope, id, {
      description: "Identity provider: the user pool's app clients",
      ...props,
    });

    this.signInTest = new UserPoolClient(this, 'SignInTest', {
      userPool: props.userPool,
      userPoolClientName: 'sign-in-test',
      generateSecret: false,
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.custom(TWITCH.name),
      ],
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
    // A client naming a provider fails to create until the provider exists.
    this.signInTest.node.addDependency(props.google, props.twitch);
    this.addManagedLoginStyle(props.userPool, this.signInTest);

    this.heliosConsole = new UserPoolClient(this, 'HeliosConsole', {
      userPool: props.userPool,
      userPoolClientName: 'helios-console',
      generateSecret: false,
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.custom(TWITCH.name),
      ],
      oAuth: {
        flows: {authorizationCodeGrant: true},
        scopes: [OAuthScope.OPENID, ...props.heliosControlScopes],
        callbackUrls: HELIOS_CONSOLE_ORIGINS.map(
          origin => `${origin}${HELIOS_CONSOLE_CALLBACK_PATH}`,
        ),
        logoutUrls: HELIOS_CONSOLE_ORIGINS.map(origin => `${origin}/`),
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
    });
    const cfnConsole = this.heliosConsole.node
      .defaultChild as CfnUserPoolClient;
    cfnConsole.explicitAuthFlows = ['ALLOW_REFRESH_TOKEN_AUTH'];
    this.heliosConsole.node.addDependency(
      props.google,
      props.twitch,
      props.heliosControl,
    );
    this.addManagedLoginStyle(props.userPool, this.heliosConsole);
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
