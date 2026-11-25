import {Template} from 'aws-cdk-lib/assertions';

import {REGION, testStack} from './test_stack';

/** The resource CDK adds to every template for its version reporting. */
const CDK_METADATA = 'AWS::CDK::Metadata';

function synthesize(): Template {
  return Template.fromStack(testStack());
}

/** An output's value with the nested stack's reference replaced by `<ref>`. */
function output(name: string): string {
  const value = synthesize().toJSON()['Outputs'][name]['Value'];
  if (value['Fn::Join'] === undefined) {
    return '<ref>';
  }
  const parts: unknown[] = value['Fn::Join'][1];
  return parts
    .map(part => (typeof part === 'string' ? part : '<ref>'))
    .join('');
}

describe('IdentityProviderStack', () => {
  it('holds only nested stacks', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'] ?? {};
    const types = Object.values(resources).map(resource => resource.Type);
    expect(types.filter(type => type !== CDK_METADATA)).toEqual([
      'AWS::CloudFormation::Stack',
    ]);
  });

  it('describes itself', () => {
    expect(synthesize().toJSON()['Description']).toBe(
      'Identity provider for our APIs and MCP servers',
    );
  });

  it('outputs the user pool, issuer and Google setup values', () => {
    expect(output('UserPoolId')).toBe('<ref>');
    expect(output('Issuer')).toBe(
      `https://issuer-cognito-idp.${REGION}.amazonaws.com/<ref>`,
    );
    expect(output('CognitoDomain')).toBe(
      `https://<ref>.auth.${REGION}.amazoncognito.com`,
    );
    expect(output('GoogleRedirectUri')).toBe(
      `https://<ref>.auth.${REGION}.amazoncognito.com/oauth2/idpresponse`,
    );
  });
});
