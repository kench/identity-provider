# Twitch sign-in setup

People can also sign in with a Twitch account, but only accounts on the allowlist. Cognito's
Twitch identity provider needs an application registered with Twitch. This is a one-time,
by-hand setup; the CDK only refers to the result.

How it works:

- Twitch sign-in goes through Cognito like Google's. Cognito asks Twitch only for `openid`, so it
  learns the Twitch user ID (`sub`) and nothing else: no email, no username.
- Anyone can create a Twitch account, so two sign-in triggers check every Twitch user against the
  allowlist table, `identity-provider-allowlist`: one on the first sign-in, before Cognito creates
  the user, and one every time Cognito issues tokens, refreshes included.
- Google users aren't checked: the Workspace limits them already.
- Every token carries `idp_iss` (the provider's issuer, `https://id.twitch.tv/oauth2` for Twitch,
  `https://accounts.google.com` for Google) and `idp_sub` (the user's ID there).

## Before you start

- The Cognito domain, `<cognito-domain>` below. Until the custom domain exists it's
  `https://kenley.auth.us-west-2.amazoncognito.com`, the `CognitoDomain` output.
- A Twitch account with two-factor authentication on; Twitch requires it to register
  applications.
- AWS access that can create a Secrets Manager secret in us-west-2 and edit the allowlist table.

## 1. Register the application

In the [Twitch developer console](https://dev.twitch.tv/console/apps), choose **Register Your
Application**:

- **Name:** what people see on Twitch's consent screen, for example "Kenley sign-in". Twitch
  requires names to be unique across Twitch.
- **OAuth Redirect URLs:** `<cognito-domain>/oauth2/idpresponse`, exactly: HTTPS, no trailing
  slash.
- **Category:** Website Integration.
- **Client Type:** Confidential.

Then open the application (**Manage**). It shows the **Client ID**. Choose **New Secret**: the
secret is shown only this once, so keep the page open until step 2 is done.

## 2. Store the credentials in Secrets Manager

As with Google's, the secret never goes into the repository, a chat, or a command line. In the
[Secrets Manager console](https://us-west-2.console.aws.amazon.com/secretsmanager/) (us-west-2):

- **Type:** Other type of secret.
- **Key/value pairs:** `clientId` = the client ID, `clientSecret` = the client secret.
- **Name:** `identity-provider/twitch-oauth`.

The secret must exist before the stack with Twitch sign-in is deployed: CloudFormation resolves it
during the deploy, and the deploy fails without it.

## 3. Tell the agent

Say that the secret `identity-provider/twitch-oauth` exists. Don't paste the client ID or secret.

## Allowing someone

The allowlist holds Twitch user IDs, not usernames, because usernames can change. The simplest way
to learn someone's ID is to let them be refused once:

1. They open the sign-in page and choose **Twitch**. Cognito refuses them with "This account isn't
   allowed to sign in."
2. In [CloudWatch Logs](https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logsV2:log-groups),
   open the log group `/identity-provider/pre-sign-up`. The latest entry is
   `{"message":"sign-in denied", … "issuer":"https://id.twitch.tv/oauth2","sub":"<Twitch user ID>"}`.
3. In the [DynamoDB console](https://us-west-2.console.aws.amazon.com/dynamodbv2/home?region=us-west-2#tables),
   open the table `identity-provider-allowlist` and create an item:
   - `issuer` (String): `https://id.twitch.tv/oauth2`
   - `sub` (String): the Twitch user ID
   - optionally `note` (String): who it is, so the list stays readable.

They can sign in straight away.

## Removing someone

Delete their item from the table. Cognito then refuses their next token refresh, so they lose
access within an hour, when their current access token expires. To cut them off at once, also
delete their user in the Cognito console (user pool `identity-provider`, user `Twitch_<user ID>`),
which revokes their refresh tokens.

## When the custom domain arrives

As with Google: before the custom domain deploy, **add** `https://<custom-domain>/oauth2/idpresponse`
to the application's OAuth Redirect URLs, keeping the prefix-domain one until nothing uses it.

## Rotating the secret

In the application, choose **New Secret**. Twitch invalidates the old secret at once, so update
`clientSecret` in `identity-provider/twitch-oauth` and redeploy straight away; Twitch sign-in fails
in between.
