/**
 * @fileoverview The pre token generation trigger (event version 2): runs
 * every time Cognito issues tokens, refreshes included, so removing someone
 * from the allowlist stops their refresh token too. It adds the upstream
 * identity to the ID and access tokens:
 *
 * - `idp_iss`: the upstream provider's issuer.
 * - `idp_sub`: the user's `sub` at that provider.
 */

import type {PreTokenGenerationV2TriggerEvent} from 'aws-lambda';

import {allowlistTable} from './allowlist_table';
import {allowedUpstream, DENIED_MESSAGE, logDenied} from './sign_in_policy';
import type {Allowlist} from './sign_in_policy';

/** The trigger, with the allowlist it checks. */
export function preTokenGeneration(allowlist: () => Allowlist) {
  return async (event: PreTokenGenerationV2TriggerEvent) => {
    const upstream = await allowedUpstream(event.userName, allowlist());
    if (upstream === undefined) {
      logDenied(event.triggerSource, event.userName);
      throw new Error(DENIED_MESSAGE);
    }
    const claims = {idp_iss: upstream.provider.issuer, idp_sub: upstream.sub};
    event.response = {
      claimsAndScopeOverrideDetails: {
        idTokenGeneration: {claimsToAddOrOverride: claims},
        accessTokenGeneration: {claimsToAddOrOverride: claims},
      },
    };
    return event;
  };
}

/** The deployed trigger. */
export const handler = preTokenGeneration(allowlistTable);
