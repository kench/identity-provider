import {Match, Template} from 'aws-cdk-lib/assertions';

import {
  COGNITO_DOMAIN_PREFIX,
  GOOGLE_OAUTH_SECRET_NAME,
  ISSUER_TYPE,
  TWITCH_OAUTH_SECRET_NAME,
  USER_POOL_NAME,
} from '../lib/user_pool_stack';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().userPool);
}

describe('UserPoolStack', () => {
  it('holds only the user pool, its domain and its sign-in', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'];
    expect(
      Object.values(resources)
        .map(resource => resource.Type)
        .sort(),
    ).toEqual([
      'AWS::Cognito::UserPool',
      'AWS::Cognito::UserPoolDomain',
      'AWS::Cognito::UserPoolIdentityProvider',
      'AWS::Cognito::UserPoolIdentityProvider',
      'AWS::DynamoDB::Table',
      'AWS::IAM::Policy',
      'AWS::IAM::Policy',
      'AWS::IAM::Role',
      'AWS::IAM::Role',
      'AWS::Lambda::Function',
      'AWS::Lambda::Function',
      'AWS::Lambda::Permission',
      'AWS::Lambda::Permission',
      'AWS::Logs::LogGroup',
      'AWS::Logs::LogGroup',
    ]);
  });

  it('allows no sign-up, recovery or local sign-in', () => {
    synthesize().hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: USER_POOL_NAME,
      UserPoolTier: 'ESSENTIALS',
      AdminCreateUserConfig: {AllowAdminCreateUserOnly: true},
      AccountRecoverySetting: {
        RecoveryMechanisms: [{Name: 'admin_only', Priority: 1}],
      },
      MfaConfiguration: 'OFF',
      UsernameConfiguration: {CaseSensitive: false},
      // No passwordless or passkey sign-in.
      Policies: Match.absent(),
    });
  });

  it('uses the updated issuer format', () => {
    expect(ISSUER_TYPE).toBe('UPDATED');
    synthesize().hasResourceProperties('AWS::Cognito::UserPool', {
      IssuerConfiguration: {Type: ISSUER_TYPE},
    });
  });

  it('keeps the user pool', () => {
    synthesize().hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({DeletionProtection: 'ACTIVE'}),
    });
  });

  it('serves the newer managed login on the Cognito prefix domain', () => {
    synthesize().hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      Domain: COGNITO_DOMAIN_PREFIX,
      ManagedLoginVersion: 2,
      CustomDomainConfig: Match.absent(),
    });
  });

  it('signs in through Google with credentials resolved from the secret', () => {
    const resolve = (field: string) =>
      `{{resolve:secretsmanager:${GOOGLE_OAUTH_SECRET_NAME}:SecretString:${field}::}}`;
    expect(GOOGLE_OAUTH_SECRET_NAME).toBe('identity-provider/google-oauth');
    synthesize().hasResourceProperties(
      'AWS::Cognito::UserPoolIdentityProvider',
      {
        ProviderName: 'Google',
        ProviderType: 'Google',
        ProviderDetails: {
          client_id: resolve('clientId'),
          client_secret: resolve('clientSecret'),
          authorize_scopes: 'openid email profile',
        },
        AttributeMapping: {
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          given_name: 'given_name',
          family_name: 'family_name',
        },
      },
    );
  });

  it('signs in through Twitch with credentials resolved from the secret', () => {
    const resolve = (field: string) =>
      `{{resolve:secretsmanager:${TWITCH_OAUTH_SECRET_NAME}:SecretString:${field}::}}`;
    expect(TWITCH_OAUTH_SECRET_NAME).toBe('identity-provider/twitch-oauth');
    synthesize().hasResourceProperties(
      'AWS::Cognito::UserPoolIdentityProvider',
      {
        ProviderName: 'Twitch',
        ProviderType: 'OIDC',
        ProviderDetails: {
          client_id: resolve('clientId'),
          client_secret: resolve('clientSecret'),
          authorize_scopes: 'openid',
          attributes_request_method: 'GET',
          oidc_issuer: 'https://id.twitch.tv/oauth2',
        },
        AttributeMapping: Match.absent(),
      },
    );
  });
});
