# identity-provider

Identity for our APIs and MCP servers, built on Amazon Cognito.

Cognito runs users, sign-in (managed login, federated to Google and Twitch), and issues access
tokens bound to the API they're for. Each token names the upstream provider and the user's ID
there (`idp_iss`, `idp_sub`). This repository configures Cognito in CDK and
provides the parts an API uses to trust those tokens:

- **CDK** (`cdk/`): the user pool, its app clients and each API's resource server and scopes.
- **Verifier** (`java/verifier/`): a Java library that checks an access token's signature,
  issuer, audience and scopes. It trusts issuers by exact `iss` match against an allowlist, so
  another issuer can be added later without changing the APIs that use it.

The first customer is a Java MCP server. It serves its own protected resource metadata (RFC 9728)
naming Cognito as its authorization server, and checks each request's bearer token with the
verifier.

The second is the Helios console (kench/helios-console), a single-page app: the public app client
`helios-console` signs in with the authorization code grant and PKCE, and asks for the Helios
Control API's scopes (`https://helios-control.services.kenley.tv/read` and `/write`); the API
checks that audience and those scopes.

Sign-in is through Google, limited to our Google Workspace, or Twitch, limited to an allowlist. The
one-time setup for each is in [docs/google-workspace-setup.md](docs/google-workspace-setup.md) and
[docs/twitch-setup.md](docs/twitch-setup.md).

## Build

```sh
cd cdk && npm ci && npm run build && npm run lint && npm test && npx cdk synth
cd java && ./gradlew check
```

Needs Node.js 26 and JDK 25.

## License

[CC0 1.0](LICENSE).
