import {Match, Template} from 'aws-cdk-lib/assertions';

import {
  COGNITO_DOMAIN_PREFIX,
  ISSUER_TYPE,
  USER_POOL_NAME,
} from '../lib/user_pool_stack';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().userPool);
}

describe('UserPoolStack', () => {
  it('holds only the user pool and its domain', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'];
    expect(
      Object.values(resources)
        .map(resource => resource.Type)
        .sort(),
    ).toEqual(['AWS::Cognito::UserPool', 'AWS::Cognito::UserPoolDomain']);
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
      // No passwordless or passkey sign-in, and no Lambda triggers.
      Policies: Match.absent(),
      LambdaConfig: Match.absent(),
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
});
