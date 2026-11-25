import {Template} from 'aws-cdk-lib/assertions';

import {MCP_SCOPE_NAME, MCP_SERVER_URL} from '../lib/resource_servers_stack';

import {testStack} from './test_stack';

function synthesize(): Template {
  return Template.fromStack(testStack().resourceServers);
}

describe('ResourceServersStack', () => {
  it('holds only the MCP server', () => {
    const resources: Record<string, {Type: string}> =
      synthesize().toJSON()['Resources'];
    expect(Object.values(resources).map(resource => resource.Type)).toEqual([
      'AWS::Cognito::UserPoolResourceServer',
    ]);
  });

  it('identifies the MCP server by its URL, with one scope', () => {
    expect(MCP_SERVER_URL).toBe('https://mcp.services.kenley.tv');
    synthesize().hasResourceProperties('AWS::Cognito::UserPoolResourceServer', {
      Identifier: MCP_SERVER_URL,
      Name: 'MCP server',
      Scopes: [
        {ScopeName: MCP_SCOPE_NAME, ScopeDescription: 'Use the MCP server'},
      ],
    });
  });
});
