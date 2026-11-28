/**
 * @fileoverview The Cognito user pool: who can sign in, and the domain its
 * managed login and OAuth endpoints are served from.
 *
 * People sign in only through Google or Twitch, so the pool holds no
 * passwords: there's no self sign-up and no account recovery.
 *
 * - Google is limited to our Workspace: its OAuth client is created by hand
 *   (docs/google-workspace-setup.md) in a Google Cloud project whose audience
 *   is Internal, so Google refuses every account outside the Workspace.
 * - Twitch is limited to the users in the allowlist table, which the sign-in
 *   triggers check (docs/twitch-setup.md).
 */

import {NestedStack, RemovalPolicy, SecretValue} from 'aws-cdk-lib';
import type {NestedStackProps} from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnUserPool,
  FeaturePlan,
  ManagedLoginVersion,
  Mfa,
  ProviderAttribute,
  UserPool,
  UserPoolIdentityProviderGoogle,
  UserPoolIdentityProviderOidc,
} from 'aws-cdk-lib/aws-cognito';
import type {UserPoolDomain} from 'aws-cdk-lib/aws-cognito';
import type {Construct} from 'constructs';

import {TWITCH} from '../lambda/sign_in_providers';
import {SignInTriggers} from './sign_in_triggers';

/** The user pool's name. */
export const USER_POOL_NAME = 'identity-provider';

/**
 * The prefix of the Cognito domain,
 * `<prefix>.auth.<region>.amazoncognito.com`, used until the custom domain
 * exists. Unique per region across all of AWS; the Google OAuth client's
 * redirect URI is built from it.
 */
export const COGNITO_DOMAIN_PREFIX = 'kenley';

/**
 * The issuer format: `UPDATED` is `https://issuer-cognito-idp.<region>...`.
 * Set from the start, because changing it changes every token's `iss`.
 */
export const ISSUER_TYPE = 'UPDATED';

/**
 * The Secrets Manager secret holding the Google OAuth client's `clientId` and
 * `clientSecret`. Only its name is here: CloudFormation resolves it at deploy
 * time, so neither value appears in the template.
 */
export const GOOGLE_OAUTH_SECRET_NAME = 'identity-provider/google-oauth';

/** The Google scopes Cognito asks for: just enough to identify the person. */
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

/**
 * The Secrets Manager secret holding the Twitch application's `clientId` and
 * `clientSecret`, referred to by name only like Google's.
 */
export const TWITCH_OAUTH_SECRET_NAME = 'identity-provider/twitch-oauth';

/** The nested stack for the user pool, its domain and its sign-in. */
export class UserPoolStack extends NestedStack {
  /** The user pool. */
  readonly userPool: UserPool;
  /** The Cognito prefix domain, with the newer managed login. */
  readonly domain: UserPoolDomain;
  /** Sign-in through Google, for our Workspace. */
  readonly google: UserPoolIdentityProviderGoogle;
  /** Sign-in through Twitch, for allowlisted users. */
  readonly twitch: UserPoolIdentityProviderOidc;
  /** The triggers that enforce the allowlist and add the upstream claims. */
  readonly triggers: SignInTriggers;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, {
      description:
        'Identity provider: the Cognito user pool, its domain and its sign-in',
      ...props,
    });

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: USER_POOL_NAME,
      featurePlan: FeaturePlan.ESSENTIALS,
      // Accounts come only from Google sign-in; Google handles passwords,
      // 2-Step Verification and recovery.
      selfSignUpEnabled: false,
      accountRecovery: AccountRecovery.NONE,
      mfa: Mfa.OFF,
      // Can't be changed after creation.
      signInCaseSensitive: false,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const cfnUserPool = this.userPool.node.defaultChild as CfnUserPool;
    cfnUserPool.issuerConfiguration = {type: ISSUER_TYPE};

    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: {domainPrefix: COGNITO_DOMAIN_PREFIX},
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const googleOAuth = (field: string) =>
      SecretValue.secretsManager(GOOGLE_OAUTH_SECRET_NAME, {jsonField: field});
    this.google = new UserPoolIdentityProviderGoogle(this, 'Google', {
      userPool: this.userPool,
      // Not a secret, but kept with the secret so that the two can't drift
      // apart and the public repository doesn't name the Google client.
      clientId: googleOAuth('clientId').unsafeUnwrap(),
      clientSecretValue: googleOAuth('clientSecret'),
      scopes: GOOGLE_SCOPES,
      // Copied from Google's ID token at every sign-in.
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
        fullname: ProviderAttribute.GOOGLE_NAME,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
      },
    });

    const twitchOAuth = (field: string) =>
      SecretValue.secretsManager(TWITCH_OAUTH_SECRET_NAME, {jsonField: field});
    this.twitch = new UserPoolIdentityProviderOidc(this, 'Twitch', {
      userPool: this.userPool,
      name: TWITCH.name,
      issuerUrl: TWITCH.issuer,
      clientId: twitchOAuth('clientId').unsafeUnwrap(),
      clientSecret: twitchOAuth('clientSecret').unsafeUnwrap(),
      // Twitch's only scope. Its email and username come only with a `claims`
      // request parameter, which Cognito doesn't send, so Cognito gets just
      // the Twitch user ID.
      scopes: ['openid'],
    });

    this.triggers = new SignInTriggers(this, 'SignInTriggers', {
      userPool: this.userPool,
    });
  }

  /** The issuer every token from this pool carries in `iss`. */
  get issuer(): string {
    return `https://issuer-cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;
  }
}
