/**
 * Should contain the same properties and methods defined by Oak
 * https://github.com/oakserver/oak
 */
export interface OakContext {
  app: any;
  cookies: any;
  request: any;
  respond: any;
  response: any;
  socket: any;
  state: any;
  assert: Function;
  send: Function;
  sendEvents: Function;
  throw: Function;
  upgrade: Function;
  params: any;
  locals?: any;
}

/**
 * Different OAuths will return different user information in different
 * structures. Dashport strategies should break down and reconstruct the user
 * info into the standardized UserProfile below
 */
export interface UserProfile {
  // the provider the user is authenticated with
  provider: string;
  // the unique id a user has with that specific provider
  providerUserId: string;
  // the display name or username for this specific user
  displayName?: string;
  name?: {
    familyName?: string;
    givenName?: string;
    middleName?: string;
  };
  emails?: Array<string>;
}

/**
 * At the bare minimum, OAuth 2.0 providers will require a client ID, client
 * secret, and redirect URI. The remaining options depend on the OAuth 2.0
 * provider, such as scope
 */
export interface Options {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  [option: string]: string;
}

/**
 * All OAuth 2.0 providers will provide access tokens
 */
export interface TokenData {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  refresh_token?: string;
}

/**
 * The form the information from strategies should come back in
 */
export interface AuthData {
  tokenData: TokenData;
  userInfo: UserProfile;
}
