import {App} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

import {IdentityProviderStack} from '../lib/identity_provider_stack';

/** The resource CDK adds to every template for its version reporting. */
const CDK_METADATA = 'AWS::CDK::Metadata';

/** The part of a CloudFormation resource these tests look at. */
interface CfnResource {
  Type: string;
}

function synthesize(): Template {
  const app = new App();
  return Template.fromStack(
    new IdentityProviderStack(app, 'IdentityProvider', {
      env: {account: '123456789012', region: 'us-west-2'},
    }),
  );
}

describe('IdentityProviderStack', () => {
  it('has no resources yet', () => {
    const resources: Record<string, CfnResource> =
      synthesize().toJSON()['Resources'] ?? {};
    const types = Object.values(resources).map(resource => resource.Type);
    expect(types.filter(type => type !== CDK_METADATA)).toEqual([]);
  });

  it('describes itself', () => {
    expect(synthesize().toJSON()['Description']).toBe(
      'Identity provider shared by Helios, Kenley and MCP',
    );
  });
});
