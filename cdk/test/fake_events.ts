import type {
  PreSignUpTriggerEvent,
  PreTokenGenerationV2TriggerEvent,
} from 'aws-lambda';

import type {Allowlist} from '../lambda/sign_in_policy';

/** An allowlist holding exactly the given `(issuer, sub)` pairs. */
export function fakeAllowlist(...entries: [string, string][]): Allowlist {
  return {
    allows: async (issuer, sub) =>
      entries.some(([i, s]) => i === issuer && s === sub),
  };
}

const common = {
  version: '1',
  region: 'us-west-2',
  userPoolId: 'us-west-2_test',
  callerContext: {awsSdkVersion: 'test', clientId: 'client'},
};

/** A pre sign-up event for the user `userName`. */
export function preSignUpEvent(
  userName: string,
  triggerSource: PreSignUpTriggerEvent['triggerSource'] = 'PreSignUp_ExternalProvider',
): PreSignUpTriggerEvent {
  return {
    ...common,
    triggerSource,
    userName,
    request: {userAttributes: {email: 'someone@example.com'}},
    response: {
      autoConfirmUser: false,
      autoVerifyEmail: false,
      autoVerifyPhone: false,
    },
  } as PreSignUpTriggerEvent;
}

/** A version 2 pre token generation event for the user `userName`. */
export function preTokenGenerationEvent(
  userName: string,
): PreTokenGenerationV2TriggerEvent {
  return {
    ...common,
    version: '2',
    triggerSource: 'TokenGeneration_RefreshTokens',
    userName,
    request: {
      userAttributes: {sub: 'cognito-sub'},
      groupConfiguration: {},
      scopes: ['openid'],
    },
    response: {claimsAndScopeOverrideDetails: {}},
  };
}
