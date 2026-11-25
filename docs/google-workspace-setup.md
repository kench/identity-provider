# Google Workspace sign-in setup

People sign in to the identity provider only through Google, limited to our Google Workspace.
Cognito's Google identity provider needs an OAuth client from Google Cloud. This is a one-time,
by-hand setup; the CDK only refers to the result.

## Before you start

- The Cognito user pool domain. Until the custom domain exists it's the prefix domain,
  `https://<prefix>.auth.us-west-2.amazoncognito.com`; the CDK stack prints it once the user pool
  is deployed. Wherever a step says `<cognito-domain>`, use it.
- A Google Workspace super admin, or an account allowed to create projects in the Workspace's
  Google Cloud organisation.
- AWS access that can create a Secrets Manager secret in us-west-2.

## 1. Create the Google Cloud project

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project inside the
   Workspace organisation (not under "No organisation"), for example `identity-provider`.
   The project must belong to the organisation, or the audience can't be set to Internal.

## 2. Set up the Google Auth Platform

In the project, open **Google Auth Platform**.

1. **Branding:** app name (what people see on Google's consent screen, for example
   "Kenley sign-in"), a support email, and a developer contact email.
2. **Audience:** **Internal**. Google then refuses every account outside the Workspace, which is
   what keeps strangers' Google accounts out of the user pool.
3. **Data access:** the scopes `openid`, `email` and `profile`. Nothing else.

## 3. Create the OAuth client

In **Google Auth Platform → Clients**, create a client:

- **Application type:** Web application.
- **Name:** for example `cognito`.
- **Authorised JavaScript origins:** `<cognito-domain>`.
- **Authorised redirect URIs:** `<cognito-domain>/oauth2/idpresponse`. It must match exactly:
  HTTPS, no trailing slash.

When you click **Create**, Google shows the client ID and client secret. **The secret is shown only
this once.** Keep the dialog open, or download the JSON, until step 4 is done.

## 4. Store the credentials in Secrets Manager

The secret never goes into the repository, a chat, or a command line (where it would end up in
shell history and process listings).

Create the secret in the [Secrets Manager console](https://us-west-2.console.aws.amazon.com/secretsmanager/)
(us-west-2):

- **Type:** Other type of secret.
- **Key/value pairs:** `clientId` = the client ID, `clientSecret` = the client secret.
- **Name:** `identity-provider/google-oauth`.

Then delete any downloaded JSON file. The CDK reads the secret by name; CloudFormation resolves it
at deploy time, so its value never appears in the template.

## 5. Tell the agent

Say that the secret `identity-provider/google-oauth` exists. Don't paste the client ID or secret:
the CDK only needs the secret's name.

## 6. Try signing in

Once the stack with Google sign-in is deployed, the deploy run's outputs include `SignInTestUrl`,
the managed login page for the `sign-in-test` app client. Open it and sign in with a Workspace
account:

- **It works** if the browser lands on `http://localhost:8080/callback?code=…`. Nothing listens
  there, so the page itself fails to load; the `code` in the address bar is the proof. Don't share
  it: it's single-use and expires in minutes, but it's still a credential until then.
- Signing in with an account outside the Workspace should fail at Google with an error that the
  app is restricted to its organisation.

The first sign-in creates the user `google_<Google subject>` in the user pool.

## When the custom domain arrives

The custom domain deploy (under `services.kenley.tv`) changes the user pool domain. Before that
deploy, **add** the new origin and `https://<custom-domain>/oauth2/idpresponse` to the same OAuth
client, keeping the prefix-domain entries until nothing uses them. Replacing them instead breaks
sign-in until the deploy finishes.

## Rotating the secret

In the OAuth client, add a new secret, update `clientSecret` in `identity-provider/google-oauth`,
redeploy, check that sign-in works, then delete the old secret in Google Cloud.
