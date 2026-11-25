# AGENTS.md

The identity provider for our APIs and MCP servers. Amazon Cognito holds users, sign-in and
tokens; this repository configures Cognito in CDK and ships what an API needs to trust its
tokens. The first customer is a Java MCP server; `README.md` covers the design.

## Layout

```
cdk/    CDK app (TypeScript): the IdentityProvider stack. cdk/AGENTS.md has the CDK instructions
java/   Gradle project (Java 25): verifier/, the iss-keyed access token verifier library
docs/   by-hand setup: Google Workspace sign-in, the deploy role
```

## Check your work

```sh
cd cdk && npm ci && npm run build && npm run lint && npm test && npx cdk synth
cd java && ./gradlew check
```

CI runs these on every PR, with at least 90% line coverage in both.

## Deploying

Only through `.github/workflows/deploy.yml`, started by hand from `main`
(`gh workflow run deploy.yml --ref main`), and only when the owner asks. Never run `cdk deploy`
locally. The workflow runs in the `production` environment and assumes `identity-provider-deploy`,
which trusts only that environment's OIDC subject (`docs/deploy-role.md`). The repository and its
Actions logs are public: keep the AWS account ID out of both.

## Rules

- Conventional Commits for commits and PR titles (checked in CI); squash merges; branch first,
  never commit to `main`.
- Scaffold new projects with their CLI (`cdk init`, `gradle init`, `smithy init`), never by hand.
- Tokens are trusted by exact `iss` match against an allowlist; never fetch discovery or keys
  for an unlisted issuer. A user is `(iss, sub)`, never `sub` alone.
- IAM grants stay least-privilege and are asserted exactly in the tests.
- Never log or print tokens, client secrets or keys, or pass them as command-line arguments.
- Sign-in is Google only, limited to our Workspace: no local users or passwords, self sign-up off.
  The Google OAuth client's credentials live in the Secrets Manager secret
  `identity-provider/google-oauth`; the CDK refers to it by name only.
- TypeScript: Google style (gts), named exports, `snake_case` files, TypeScript 6.0 until
  typescript-eslint supports 7. Java: Google Java Style, Dagger for dependency injection,
  JUnit, JaCoCo and Mockito.
- DynamoDB tables: `TableClass.STANDARD`, on-demand billing, retained.

## Temporary simplifications

Don't reverse these silently; each ends with its own change:

- No WAF. Until it exists, Cognito's open dynamic client registration stays off and MCP clients
  are pre-registered in CDK.
- No custom domain. It comes later under `services.kenley.tv` as a separate deploy, since that
  deploy waits on DNS records added by hand.

## Out of scope

Token exchange, our own token issuer, an identity map and a management API wait until a second
issuer or customer needs them. Existing systems keep their own authentication.
