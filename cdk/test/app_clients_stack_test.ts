import {Match, Template} from 'aws-cdk-lib/assertions';

import {
  HELIOS_CONSOLE_CALLBACK_PATH,
  HELIOS_CONSOLE_ORIGINS,
  SIGN_IN_TEST_CALLBACK_URL,
} from '../lib/app_clients_stack';
import {HELIOS_CONTROL_URL} from '../lib/resource_servers_stack';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().appClients);
}

describe('AppClientsStack', () => {
  it('holds only the two clients and their managed login styles', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'];
    expect(
      Object.values(resources)
        .map(resource => resource.Type)
        .sort(),
    ).toEqual([
      'AWS::Cognito::ManagedLoginBranding',
      'AWS::Cognito::ManagedLoginBranding',
      'AWS::Cognito::UserPoolClient',
      'AWS::Cognito::UserPoolClient',
    ]);
  });

  it("styles each client's managed login with the defaults", () => {
    const template = synthesize();
    for (const clientId of Object.keys(
      template.findResources('AWS::Cognito::UserPoolClient'),
    )) {
      template.hasResourceProperties('AWS::Cognito::ManagedLoginBranding', {
        ClientId: {Ref: clientId},
        UseCognitoProvidedValues: true,
        Settings: Match.absent(),
        Assets: Match.absent(),
      });
    }
  });

  it('lets the Helios console sign in with PKCE for the Control API only', () => {
    expect(HELIOS_CONSOLE_ORIGINS).toEqual([
      'https://dnhrhf7ycdrhi.cloudfront.net',
      'http://localhost:5173',
    ]);
    expect(HELIOS_CONSOLE_CALLBACK_PATH).toBe('/auth/callback');
    synthesize().hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'helios-console',
      GenerateSecret: false,
      SupportedIdentityProviders: ['Google', 'Twitch'],
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: [
        'openid',
        `${HELIOS_CONTROL_URL}/read`,
        `${HELIOS_CONTROL_URL}/write`,
      ],
      CallbackURLs: [
        'https://dnhrhf7ycdrhi.cloudfront.net/auth/callback',
        'http://localhost:5173/auth/callback',
      ],
      LogoutURLs: [
        'https://dnhrhf7ycdrhi.cloudfront.net/',
        'http://localhost:5173/',
      ],
      PreventUserExistenceErrors: 'ENABLED',
      EnableTokenRevocation: true,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 24 * 60,
    });
  });

  it('lets the sign-in test client sign in through Google or Twitch', () => {
    expect(SIGN_IN_TEST_CALLBACK_URL).toBe('http://localhost:8080/callback');
    synthesize().hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'sign-in-test',
      GenerateSecret: false,
      SupportedIdentityProviders: ['Google', 'Twitch'],
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
