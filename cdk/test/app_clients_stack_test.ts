import {Match, Template} from 'aws-cdk-lib/assertions';

import {SIGN_IN_TEST_CALLBACK_URL} from '../lib/app_clients_stack';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().appClients);
}

describe('AppClientsStack', () => {
  it('holds only the sign-in test client', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'];
    expect(Object.values(resources).map(resource => resource.Type)).toEqual([
      'AWS::Cognito::UserPoolClient',
    ]);
  });

  it('lets the sign-in test client sign in through Google only', () => {
    expect(SIGN_IN_TEST_CALLBACK_URL).toBe('http://localhost:8080/callback');
    synthesize().hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'sign-in-test',
      GenerateSecret: false,
      SupportedIdentityProviders: ['Google'],
      // No password, SRP or custom sign-in through the Cognito API.
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      CallbackURLs: [SIGN_IN_TEST_CALLBACK_URL],
      LogoutURLs: Match.absent(),
      PreventUserExistenceErrors: 'ENABLED',
      EnableTokenRevocation: true,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 24 * 60,
      TokenValidityUnits: {
        AccessToken: 'minutes',
        IdToken: 'minutes',
        RefreshToken: 'minutes',
      },
    });
  });
});
