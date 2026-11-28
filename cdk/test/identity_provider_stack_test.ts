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
  if (typeof value === 'string') {
    return value;
  }
  if (value['Fn::Join'] === undefined) {
    return '<ref>';
  }
  const parts: unknown[] = value['Fn::Join'][1];
  return parts
    .map(part => (typeof part === 'string' ? part : '<ref>'))
    .join('');
}

describe('IdentityProviderStack', () => {
  it('holds only the nested stacks', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'] ?? {};
    const types = Object.values(resources).map(resource => resource.Type);
    expect(types.filter(type => type !== CDK_METADATA)).toEqual([
      'AWS::CloudFormation::Stack',
      'AWS::CloudFormation::Stack',
      'AWS::CloudFormation::Stack',
    ]);
  });

  it('describes itself', () => {
    expect(synthesize().toJSON()['Description']).toBe(
      'Identity provider for our APIs and MCP servers',
    );
  });

  it('creates the app clients after Google sign-in exists', () => {
    const stacks = synthesize().findResources('AWS::CloudFormation::Stack');
    const [id, appClients] = Object.entries(stacks).find(([key]) =>
      key.startsWith('AppClients'),
    )!;
    expect(id).toBeDefined();
    expect(appClients['DependsOn']).toEqual([
      expect.stringMatching(/^UserPoolNestedStack/),
    ]);
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
    expect(output('McpResource')).toBe('https://mcp.services.kenley.tv');
    expect(output('McpScope')).toBe('https://mcp.services.kenley.tv/mcp');
    expect(output('SignInTestUrl')).toBe(
      `https://<ref>.auth.${REGION}.amazoncognito.com/login?client_id=<ref>` +
        '&response_type=code&redirect_uri=http://localhost:8080/callback',
    );
  });
});
