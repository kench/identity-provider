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

/**
 * The Helios Control API's resource identifier, and the `aud` of the access
 * tokens issued for it. A stable name for the API, not where it's served:
 * nothing needs to answer at this URL. Changing it invalidates every token
 * issued for it.
 */
export const HELIOS_CONTROL_URL = 'https://helios-control.services.kenley.tv';

/** The Helios Control API's scopes: reading devices, and changing them. */
export const HELIOS_CONTROL_SCOPES = {
  read: 'View Helios devices, their streams and Wi-Fi networks',
  write: "Change Helios devices' streams and Wi-Fi networks",
} as const;

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
  /** The Helios Control API. */
  readonly heliosControl: UserPoolResourceServer;
  /** Its scopes: `<Helios Control URL>/read` and `/write`. */
  readonly heliosControlScopes: OAuthScope[];

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

    const heliosScopes = Object.entries(HELIOS_CONTROL_SCOPES).map(
      ([scopeName, scopeDescription]) =>
        new ResourceServerScope({scopeName, scopeDescription}),
    );
    this.heliosControl = new UserPoolResourceServer(this, 'HeliosControl', {
      userPool: props.userPool,
      identifier: HELIOS_CONTROL_URL,
      userPoolResourceServerName: 'Helios Control API',
      scopes: heliosScopes,
    });
    // Plain strings from the constant identifier, so clients in other
    // stacks don't take a reference to this one (they depend on it instead).
    this.heliosControlScopes = Object.keys(HELIOS_CONTROL_SCOPES).map(name =>
      OAuthScope.custom(`${HELIOS_CONTROL_URL}/${name}`),
    );
  }
}
