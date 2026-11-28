/**
 * @fileoverview The pre sign-up trigger: runs on a person's first sign-in,
 * before Cognito creates their user, and refuses anyone who may not sign in.
 * Local users (self sign-up or created by an admin) are always refused.
 */

import type {PreSignUpTriggerEvent} from 'aws-lambda';

import {allowlistTable} from './allowlist_table';
import {allowedUpstream, DENIED_MESSAGE, logDenied} from './sign_in_policy';
import type {Allowlist} from './sign_in_policy';

/** The trigger, with the allowlist it checks. */
export function preSignUp(allowlist: () => Allowlist) {
  return async (event: PreSignUpTriggerEvent) => {
    if (
      event.triggerSource !== 'PreSignUp_ExternalProvider' ||
      (await allowedUpstream(event.userName, allowlist())) === undefined
    ) {
      logDenied(event.triggerSource, event.userName);
      throw new Error(DENIED_MESSAGE);
    }
    return event;
  };
}

/** The deployed trigger. */
export const handler = preSignUp(allowlistTable);
