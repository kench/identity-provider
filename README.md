# identity-provider

Identity for our APIs and MCP servers, built on Amazon Cognito.

Cognito runs users, sign-in (managed login with MFA, passkeys and federated OIDC providers), and
issues access tokens bound to the API they're for. This repository configures Cognito in CDK and
provides the parts an API uses to trust those tokens:

- **CDK** (`cdk/`): the user pool, its app clients and each API's resource server and scopes.
- **Verifier** (`java/verifier/`): a Java library that checks an access token's signature,
  issuer, audience and scopes. It trusts issuers by exact `iss` match against an allowlist, so
  another issuer can be added later without changing the APIs that use it.

The first customer is a Java MCP server. It serves its own protected resource metadata (RFC 9728)
naming Cognito as its authorization server, and checks each request's bearer token with the
verifier.

## Build

```sh
cd cdk && npm ci && npm run build && npm run lint && npm test && npx cdk synth
cd java && ./gradlew check
```

Needs Node.js 26 and JDK 25.

## License

[CC0 1.0](LICENSE).
