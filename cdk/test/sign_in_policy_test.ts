import type {
  AttributeValue,
  GetItemCommand,
  GetItemCommandOutput,
} from '@aws-sdk/client-dynamodb';

import {
  allowedUpstream,
  logDenied,
  TableAllowlist,
  upstreamOf,
} from '../lambda/sign_in_policy';
import {GOOGLE, TWITCH} from '../lambda/sign_in_providers';

import {fakeAllowlist} from './fake_events';

describe('sign-in providers', () => {
  it('allowlists Twitch but not Google', () => {
    expect(GOOGLE).toEqual({
      name: 'Google',
      issuer: 'https://accounts.google.com',
      allowlisted: false,
    });
    expect(TWITCH).toEqual({
      name: 'Twitch',
      issuer: 'https://id.twitch.tv/oauth2',
      allowlisted: true,
    });
  });
});

describe('upstreamOf', () => {
  it('reads the provider and sub from a federated username', () => {
    expect(upstreamOf('Twitch_12345')).toEqual({
      provider: TWITCH,
      sub: '12345',
    });
    expect(upstreamOf('google_10769')).toEqual({
      provider: GOOGLE,
      sub: '10769',
    });
  });

  it('keeps underscores after the first in the sub', () => {
    expect(upstreamOf('Twitch_a_b')).toEqual({provider: TWITCH, sub: 'a_b'});
  });

  it.each(['someone', '_12345', 'Twitch_', 'Facebook_12345', ''])(
    'finds no upstream in %j',
    userName => {
      expect(upstreamOf(userName)).toBeUndefined();
    },
  );
});

describe('allowedUpstream', () => {
  const allowlist = fakeAllowlist([TWITCH.issuer, '12345']);

  it('allows any Google user without checking the allowlist', async () => {
    const allows = jest.fn();
    expect(await allowedUpstream('Google_999', {allows})).toEqual({
      provider: GOOGLE,
      sub: '999',
    });
    expect(allows).not.toHaveBeenCalled();
  });

  it('allows only allowlisted Twitch users', async () => {
    expect(await allowedUpstream('Twitch_12345', allowlist)).toEqual({
      provider: TWITCH,
      sub: '12345',
    });
    expect(await allowedUpstream('Twitch_67890', allowlist)).toBeUndefined();
  });

  it('matches the allowlist by issuer as well as sub', async () => {
    const googleEntry = fakeAllowlist([GOOGLE.issuer, '12345']);
    expect(await allowedUpstream('Twitch_12345', googleEntry)).toBeUndefined();
  });

  it('refuses users from no known provider', async () => {
    expect(await allowedUpstream('someone', allowlist)).toBeUndefined();
  });
});

describe('TableAllowlist', () => {
  function allowlistReturning(
    item: Record<string, AttributeValue> | undefined,
  ) {
    const send = jest.fn<Promise<GetItemCommandOutput>, [GetItemCommand]>(
      async () => ({
        Item: item,
        $metadata: {},
      }),
    );
    return {send, allowlist: new TableAllowlist({send}, 'allowlist')};
  }

  it('reads the item for (issuer, sub) consistently', async () => {
    const {send, allowlist} = allowlistReturning({issuer: {S: TWITCH.issuer}});
    expect(await allowlist.allows(TWITCH.issuer, '12345')).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({
      TableName: 'allowlist',
      Key: {issuer: {S: TWITCH.issuer}, sub: {S: '12345'}},
      ProjectionExpression: 'issuer',
      ConsistentRead: true,
    });
  });

  it('refuses when there is no item', async () => {
    const {allowlist} = allowlistReturning(undefined);
    expect(await allowlist.allows(TWITCH.issuer, '12345')).toBe(false);
  });
});

describe('logDenied', () => {
  it('logs the upstream identity only', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logDenied('PreSignUp_ExternalProvider', 'Twitch_12345');
    logDenied('PreSignUp_SignUp', 'someone');
    expect(warn.mock.calls.map(call => JSON.parse(call[0]))).toEqual([
      {
        message: 'sign-in denied',
        trigger: 'PreSignUp_ExternalProvider',
        issuer: TWITCH.issuer,
        sub: '12345',
      },
      {message: 'sign-in denied', trigger: 'PreSignUp_SignUp'},
    ]);
  });
});
