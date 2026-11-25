# Deploy role setup

`.github/workflows/deploy.yml` deploys with its own IAM role, `identity-provider-deploy`, which
only this repository's `production` environment can assume. It's created once by hand, like the
account's GitHub OIDC provider; nothing deployed by this repository can change it.

Below, `<account-id>` is the AWS account ID. It's kept out of this public repository.

## 1. The role

In the IAM console, create a role with a **custom trust policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:kench@34564/identity-provider@1471180501:environment:production"
        }
      }
    }
  ]
}
```

The `sub` is the repository's immutable OIDC subject: owner and repository are matched by ID, so
a repository deleted and recreated under the same name can't assume the role. Only jobs in the
`production` environment get this subject.

Name the role `identity-provider-deploy`, with the default maximum session of one hour.

## 2. Its permissions

Add one inline policy, `cdk-deploy`. The role can do nothing itself except assume the CDK
bootstrap roles, which publish the templates and run the CloudFormation deploy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": [
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-deploy-role-<account-id>-us-west-2",
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-file-publishing-role-<account-id>-us-west-2",
        "arn:aws:iam::<account-id>:role/cdk-hnb659fds-lookup-role-<account-id>-us-west-2"
      ]
    }
  ]
}
```

The custom domain deploy later adds a stack in us-east-1, which needs CDK bootstrapped there and
the same three roles for `us-east-1` added to this list.

## 3. The GitHub environment

In the repository's **Settings → Environments**, create `production`:

- **Deployment branches:** selected branches, `main` only.
- **Environment secret** `AWS_ROLE_ARN`: the role's ARN,
  `arn:aws:iam::<account-id>:role/identity-provider-deploy`. A secret rather than a variable, so
  the account ID in it is masked in the public logs.

## Deploying

```sh
gh workflow run deploy.yml --ref main
```

The run logs a `cdk diff` before deploying.
