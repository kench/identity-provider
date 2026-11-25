/**
 * @fileoverview The APIs that accept the user pool's access tokens, as Cognito
 * resource servers, each with its scopes.
 *
 * A resource server's identifier is the API's URL. A client that sends it as
 * the `resource` parameter (RFC 8707) gets an access token whose `aud` is that
 * URL, so the token is good for that API only. MCP clients always send it.
 */

import {NestedStack} from 'aws-cdk-lib';
import type {NestedStackProps} from 'aws-cdk-lib';
import {
  OAuthScope,
  ResourceServerScope,
  UserPoolResourceServer,
} from 'aws-cdk-lib/aws-cognito';
import type {UserPool} from 'aws-cdk-lib/aws-cognito';
import type {Construct} from 'constructs';

/**
 * The MCP server's URL: its resource identifier, and the `aud` of the access
 * tokens issued for it. Changing it invalidates every token issued for it.
 */
export const MCP_SERVER_URL = 'https://mcp.services.kenley.tv';

/** The MCP server's one scope, for now: everything the server offers. */
export const MCP_SCOPE_NAME = 'mcp';

/** What the resource servers stack needs from the user pool stack. */
export interface ResourceServersStackProps extends NestedStackProps {
  /** The user pool whose tokens the APIs accept. */
  readonly userPool: UserPool;
}

/** The nested stack for the resource servers and their scopes. */
export class ResourceServersStack extends NestedStack {
  /** The MCP server. */
  readonly mcpServer: UserPoolResourceServer;
  /** The scope an MCP client asks for: `<MCP server URL>/mcp`. */
  readonly mcpScope: OAuthScope;

  constructor(scope: Construct, id: string, props: ResourceServersStackProps) {
    super(scope, id, {
      description: 'Identity provider: the APIs that accept its access tokens',
      ...props,
    });

    const mcp = new ResourceServerScope({
      scopeName: MCP_SCOPE_NAME,
      scopeDescription: 'Use the MCP server',
    });
    // Not userPool.addResourceServer(), which would put it in the user pool's
    // stack.
    this.mcpServer = new UserPoolResourceServer(this, 'McpServer', {
      userPool: props.userPool,
      identifier: MCP_SERVER_URL,
      userPoolResourceServerName: 'MCP server',
      scopes: [mcp],
    });
    this.mcpScope = OAuthScope.resourceServer(this.mcpServer, mcp);
  }
}
