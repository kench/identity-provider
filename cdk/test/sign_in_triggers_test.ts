import {Match, Template} from 'aws-cdk-lib/assertions';

import {ALLOWLIST_TABLE_NAME} from '../lib/sign_in_triggers';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().userPool);
}

/** The logical ID of the only resource of `type` matching `props`. */
function idOf(template: Template, type: string, props: object = {}): string {
  const ids = Object.keys(
    template.findResources(type, {Properties: Match.objectLike(props)}),
  );
  expect(ids).toHaveLength(1);
  return ids[0];
}

describe('SignInTriggers', () => {
  it('keeps the allowlist table', () => {
    expect(ALLOWLIST_TABLE_NAME).toBe('identity-provider-allowlist');
    synthesize().hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: {
        TableName: ALLOWLIST_TABLE_NAME,
        KeySchema: [
          {AttributeName: 'issuer', KeyType: 'HASH'},
          {AttributeName: 'sub', KeyType: 'RANGE'},
        ],
        AttributeDefinitions: [
          {AttributeName: 'issuer', AttributeType: 'S'},
          {AttributeName: 'sub', AttributeType: 'S'},
        ],
        TableClass: 'STANDARD',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {PointInTimeRecoveryEnabled: true},
        DeletionProtectionEnabled: true,
      },
    });
  });

  it('runs both triggers, pre token generation with version 2 events', () => {
    const template = synthesize();
    const preSignUp = idOf(template, 'AWS::Lambda::Function', {
      Role: {'Fn::GetAtt': [Match.stringLikeRegexp('PreSignUpRole'), 'Arn']},
    });
    const preTokenGeneration = idOf(template, 'AWS::Lambda::Function', {
      Role: {
        'Fn::GetAtt': [Match.stringLikeRegexp('PreTokenGenerationRole'), 'Arn'],
      },
    });
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PreSignUp: {'Fn::GetAtt': [preSignUp, 'Arn']},
        PreTokenGenerationConfig: {
          LambdaArn: {'Fn::GetAtt': [preTokenGeneration, 'Arn']},
          LambdaVersion: 'V2_0',
        },
      },
    });
    const pool = idOf(template, 'AWS::Cognito::UserPool');
    for (const fn of [preSignUp, preTokenGeneration]) {
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        FunctionName: {'Fn::GetAtt': [fn, 'Arn']},
        Principal: 'cognito-idp.amazonaws.com',
        SourceArn: {'Fn::GetAtt': [pool, 'Arn']},
      });
    }
  });

  it('configures each function to answer within Cognito’s limit', () => {
    const template = synthesize();
    const table = idOf(template, 'AWS::DynamoDB::Table');
    const functions = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(functions)).toHaveLength(2);
    for (const fn of Object.values(functions)) {
      expect(fn['Properties']).toMatchObject({
        Runtime: 'nodejs24.x',
        Architectures: ['arm64'],
        MemorySize: 256,
        Timeout: 5,
        Environment: {Variables: {ALLOWLIST_TABLE: {Ref: table}}},
      });
    }
    template.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 30,
    });
    const names = Object.values(
      template.findResources('AWS::Logs::LogGroup'),
    ).map(group => group['Properties']['LogGroupName']);
    expect(names.sort()).toEqual([
      '/identity-provider/pre-sign-up',
      '/identity-provider/pre-token-generation',
    ]);
  });

  it('lets each function only read allowlist items and write its logs', () => {
    const template = synthesize();
    const table = idOf(template, 'AWS::DynamoDB::Table');
    for (const name of ['PreSignUp', 'PreTokenGeneration']) {
      const roles = Object.entries(
        template.findResources('AWS::IAM::Role'),
      ).filter(([id]) => id.includes(`${name}Role`));
      expect(roles).toHaveLength(1);
      const [roleId, roleResource] = roles[0];
      expect(roleResource['Properties']).toEqual({
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {Service: 'lambda.amazonaws.com'},
            },
          ],
          Version: '2012-10-17',
        },
      });
      const logs = Object.keys(
        template.findResources('AWS::Logs::LogGroup'),
      ).filter(id => id.includes(`${name}Logs`));
      expect(logs).toHaveLength(1);
      template.hasResourceProperties('AWS::IAM::Policy', {
        Roles: [{Ref: roleId}],
        PolicyDocument: {
          Statement: [
            {
              Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              Effect: 'Allow',
              Resource: {'Fn::GetAtt': [logs[0], 'Arn']},
            },
            {
              Action: 'dynamodb:GetItem',
              Effect: 'Allow',
              // The table itself: no index, no other table.
              Resource: [{'Fn::GetAtt': [table, 'Arn']}],
            },
          ],
          Version: '2012-10-17',
        },
      });
    }
  });
});
