/**
 * @fileoverview The identity providers people sign in through, shared by the
 * CDK and the sign-in triggers so that the two can't disagree.
 */

/** An upstream identity provider, as Cognito knows it. */
export interface SignInProvider {
  /** Cognito's name for it: the prefix of its users' Cognito usernames. */
  readonly name: string;
  /** Its issuer, which tokens carry as `idp_iss`. */
  readonly issuer: string;
  /** Whether its users must be on the allowlist to sign in. */
  readonly allowlisted: boolean;
}

/**
 * Google, limited to our Workspace by the Google OAuth client's Internal
 * audience, so no allowlist.
 */
export const GOOGLE: SignInProvider = {
  name: 'Google',
  issuer: 'https://accounts.google.com',
  allowlisted: false,
};

/** Twitch, which anyone can sign up to, so only allowlisted users. */
export const TWITCH: SignInProvider = {
  name: 'Twitch',
  issuer: 'https://id.twitch.tv/oauth2',
  allowlisted: true,
};

/** Every provider the user pool has. */
export const SIGN_IN_PROVIDERS: readonly SignInProvider[] = [GOOGLE, TWITCH];
