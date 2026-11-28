import {preSignUp} from '../lambda/pre_sign_up';
import {preTokenGeneration} from '../lambda/pre_token_generation';
import {DENIED_MESSAGE} from '../lambda/sign_in_policy';
import {GOOGLE, TWITCH} from '../lambda/sign_in_providers';

import {
  fakeAllowlist,
  preSignUpEvent,
  preTokenGenerationEvent,
} from './fake_events';

const allowlist = () => fakeAllowlist([TWITCH.issuer, '12345']);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('pre sign-up trigger', () => {
  const trigger = preSignUp(allowlist);

  it('lets allowed users sign up unchanged', async () => {
    for (const userName of ['Google_999', 'Twitch_12345']) {
      const event = preSignUpEvent(userName);
      expect(await trigger(event)).toEqual(preSignUpEvent(userName));
    }
  });

  it('refuses Twitch users who are not on the allowlist', async () => {
    await expect(trigger(preSignUpEvent('Twitch_67890'))).rejects.toThrow(
      DENIED_MESSAGE,
    );
  });

  it.each(['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser'] as const)(
    'refuses local users (%s)',
    async triggerSource => {
      await expect(
        trigger(preSignUpEvent('Google_999', triggerSource)),
      ).rejects.toThrow(DENIED_MESSAGE);
    },
  );
});

describe('pre token generation trigger', () => {
  const trigger = preTokenGeneration(allowlist);

  it.each([
    ['Google_999', GOOGLE.issuer, '999'],
    ['Twitch_12345', TWITCH.issuer, '12345'],
  ])(
    'adds the upstream identity of %s to both tokens',
    async (userName, issuer, sub) => {
      const event = await trigger(preTokenGenerationEvent(userName));
      const claims = {idp_iss: issuer, idp_sub: sub};
      expect(event.response).toEqual({
        claimsAndScopeOverrideDetails: {
          idTokenGeneration: {claimsToAddOrOverride: claims},
          accessTokenGeneration: {claimsToAddOrOverride: claims},
        },
      });
    },
  );

  it('refuses users removed from the allowlist', async () => {
    await expect(
      trigger(preTokenGenerationEvent('Twitch_67890')),
    ).rejects.toThrow(DENIED_MESSAGE);
  });

  it('refuses local users', async () => {
    await expect(trigger(preTokenGenerationEvent('someone'))).rejects.toThrow(
      DENIED_MESSAGE,
    );
  });
});
