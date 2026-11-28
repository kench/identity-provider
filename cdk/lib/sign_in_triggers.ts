/**
 * @fileoverview The user pool's sign-in triggers and the allowlist they check.
 *
 * Both triggers refuse users of allowlisted providers (Twitch) who aren't in
 * the allowlist table: pre sign-up before their user is created, and pre
 * token generation at every token issue, refreshes included. Pre token
 * generation also adds `idp_iss` and `idp_sub` to the tokens. The code is in
 * `lambda/`.
 */

import * as path from 'node:path';

import {Duration, RemovalPolicy} from 'aws-cdk-lib';
import {LambdaVersion, UserPoolOperation} from 'aws-cdk-lib/aws-cognito';
import type {UserPool} from 'aws-cdk-lib/aws-cognito';
import {
  AttributeType,
  BillingMode,
  Table,
  TableClass,
} from 'aws-cdk-lib/aws-dynamodb';
import {Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {Architecture, Runtime} from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import {LogGroup, RetentionDays} from 'aws-cdk-lib/aws-logs';
import {Construct} from 'constructs';

import {ALLOWLIST_TABLE_ENV} from '../lambda/allowlist_table';

/** The allowlist table's name, which the setup guide's commands use. */
export const ALLOWLIST_TABLE_NAME = 'identity-provider-allowlist';

/** The start of each trigger's log group name. */
export const LOG_GROUP_PREFIX = '/identity-provider/';

/** What the triggers need. */
export interface SignInTriggersProps {
  /** The user pool the triggers run for. */
  readonly userPool: UserPool;
}

/** The sign-in triggers, their allowlist table and their logs. */
export class SignInTriggers extends Construct {
  /**
   * The allowlist: one item per user who may sign in through an allowlisted
   * provider, keyed by the provider's issuer (`issuer`) and the user's `sub`
   * there (`sub`).
   */
  readonly allowlist: Table;
  /** The pre sign-up trigger. */
  readonly preSignUp: NodejsFunction;
  /** The pre token generation trigger. */
  readonly preTokenGeneration: NodejsFunction;

  constructor(scope: Construct, id: string, props: SignInTriggersProps) {
    super(scope, id);

    this.allowlist = new Table(this, 'Allowlist', {
      tableName: ALLOWLIST_TABLE_NAME,
      partitionKey: {name: 'issuer', type: AttributeType.STRING},
      sortKey: {name: 'sub', type: AttributeType.STRING},
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {pointInTimeRecoveryEnabled: true},
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.preSignUp = this.trigger('PreSignUp', 'pre_sign_up');
    this.preTokenGeneration = this.trigger(
      'PreTokenGeneration',
      'pre_token_generation',
    );
    props.userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, this.preSignUp);
    // Version 2 events are the ones that can add claims to access tokens.
    props.userPool.addTrigger(
      UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      this.preTokenGeneration,
      LambdaVersion.V2_0,
    );
  }

  /**
   * A trigger function that can only read allowlist items and write to its own
   * log group.
   */
  private trigger(id: string, name: string): NodejsFunction {
    const logGroup = new LogGroup(this, `${id}Logs`, {
      // Named, so that the setup guide can say where refusals are logged.
      logGroupName: `${LOG_GROUP_PREFIX}${name.replaceAll('_', '-')}`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // Not the default role, whose managed policy can write to any log group.
    const role = new Role(this, `${id}Role`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    logGroup.grantWrite(role);
    this.allowlist.grant(role, 'dynamodb:GetItem');

    return new NodejsFunction(this, id, {
      entry: path.join(__dirname, '..', 'lambda', `${name}.ts`),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      // Cognito waits at most 5 seconds for a trigger.
      timeout: Duration.seconds(5),
      environment: {[ALLOWLIST_TABLE_ENV]: this.allowlist.tableName},
      role,
      logGroup,
      bundling: {minify: true},
    });
  }
}
