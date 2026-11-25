/**
 * @fileoverview The Cognito user pool: who can sign in, and the domain its
 * managed login and OAuth endpoints are served from.
 *
 * People sign in only through Google, limited to our Workspace, so the pool
 * holds no passwords: there's no self sign-up and no account recovery. The
 * Google identity provider and the app clients come in later changes, once the
 * Google OAuth client exists.
 */

import {NestedStack, RemovalPolicy} from 'aws-cdk-lib';
import type {NestedStackProps} from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnUserPool,
  FeaturePlan,
  ManagedLoginVersion,
  Mfa,
  UserPool,
} from 'aws-cdk-lib/aws-cognito';
import type {UserPoolDomain} from 'aws-cdk-lib/aws-cognito';
import type {Construct} from 'constructs';

/** The user pool's name. */
export const USER_POOL_NAME = 'identity-provider';

/**
 * The prefix of the Cognito domain,
 * `<prefix>.auth.<region>.amazoncognito.com`, used until the custom domain
 * exists. Unique per region across all of AWS; free to change until the first
 * deploy, since the Google OAuth client's redirect URI is built from it.
 */
export const COGNITO_DOMAIN_PREFIX = 'kenley';

/**
 * The issuer format: `UPDATED` is `https://issuer-cognito-idp.<region>...`.
 * Set from the start, because changing it changes every token's `iss`.
 */
export const ISSUER_TYPE = 'UPDATED';

/** The nested stack for the user pool and its domain. */
export class UserPoolStack extends NestedStack {
  /** The user pool. */
  readonly userPool: UserPool;
  /** The Cognito prefix domain, with the newer managed login. */
  readonly domain: UserPoolDomain;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, {
      description: 'Identity provider: the Cognito user pool and its domain',
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
  }

  /** The issuer every token from this pool carries in `iss`. */
  get issuer(): string {
    return `https://issuer-cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;
  }
}
