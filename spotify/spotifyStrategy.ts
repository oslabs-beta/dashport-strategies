import { OakContext, Options, AuthData, TokenData} from '../types.ts';
import { Base64 } from 'https://deno.land/x/bb64/mod.ts';  

/**
 * Creates an instance of `SpotifyStrategy`.
 * 
 * * Options:
 *
 *   -  client_id: string                  Required
 *   -  client_secret: string              Required
 *   -  redirect_uri: string               Required
 *   -  state: string;
 *   -  scope: string;
 *   -  client_secret: string;
 *
 */
export default class SpotifyStrategy {
  name: string = 'spotify'
  options: Options;
  uriFromParams: string;
  authURL: string = 'https://accounts.spotify.com/authorize?';
  tokenURL: string = 'https://accounts.spotify.com/api/token?';
  authDataURL: string = 'https://api.spotify.com/v1/me?';
  /**
   * @constructor
   * @param {Object} options
   * @api public
   */
  constructor (options: Options) {
    if (!options.client_id || !options.redirect_uri || !options.state || !options.client_secret) {
      throw new Error('ERROR in SpotifyStrategy constructor: Missing required arguments');
    }

    this.options = options;

    // PRE STEP 1: 
      // Constructs the second half of the authURL for developer's first endpoint from the info put into 'options'
    this.uriFromParams = this.constructURI(this.options, ['client_secret']);
  }

  constructURI(options: any, skip?: string[]): any {
    const paramArray: string[][] = Object.entries(options); 
    let paramString: string = '';

    for (let i = 0; i < paramArray.length; i++) {
      let [key, value] = paramArray[i];

      if (skip && skip.includes(key)) continue;
      // adds the key and '=' for every member of options not in the skip array
      paramString += (key + '=');
      // adds the value and '&' for every member of options not in the skip array
      paramString += (value + '&');
    }

    // removes the '&' that was just placed at the end of the string
    if (paramString[paramString.length - 1] === '&') {
      paramString = paramString.slice(0, -1);
    }

    return paramString;
  }

  // parses an encoded URI 
  parseCode(encodedCode: string): string {
    const replacements: { [name: string] : string } = {
      "%24": "$",
      "%26": "&",
      "%2B": "+",
      "%2C": ",",
      "%2F": "/",
      "%3A": ":",
      "%3B": ";",
      "%3D": "=",
      "%3F": "?",
      "%40": "@"
    }

    const toReplaceArray: string[] = Object.keys(replacements);

    for(let i = 0; i < toReplaceArray.length; i++) {
      while (encodedCode.includes(toReplaceArray[i])) {
        encodedCode = encodedCode.replace(toReplaceArray[i], replacements[toReplaceArray[i]]);
      }
    }

    return encodedCode; 
  }

  // ENTRY POINT
  async router(ctx: OakContext, next: Function) {
    // GO_Step 1 Request Permission
    if (!ctx.request.url.search) return await this.authorize(ctx, next);
    // GO_Step 3 Exchange code for Token
    if (ctx.request.url.search.slice(1, 5) === 'code') return this.getAuthToken(ctx, next);
  }
  
  // STEP 1: sends the programatically constructed uri to an oauth 2.0 server
  async authorize(ctx: OakContext, next: Function) {
    return await ctx.response.redirect(this.authURL + this.uriFromParams);                   
  }

  // STEP 2: client says yes or no

  // STEP 3: handle oauth 2.0 server response containing auth code
  // STEP 3.5: request access token in exchange for auth code
  async getAuthToken(ctx: OakContext, next: Function) {
    // the URI sent back from the endpoint you provided in step 1
    const OGURI: string = ctx.request.url.search;

    if (OGURI.includes('error')) {
      return new Error('ERROR in getAuthToken: Received an error from auth token code request.');
    }

    // EXTRACT THE AUTH CODE
    // splits the string at the '=,' storing the first part in URI1[0] and the part wanted in URI1[1]
    let URI1: string[] = OGURI.split('=');
    // splits the string at the ampersand(&), storing the string with the access_token in URI2[0] 
    // and the other parameters at URI2[n]
    const URI2: string[] = URI1[1].split('&');
    // PARSE THE URI
    const code: string = this.parseCode(URI2[0]);

    // STEP 3.5
    const bodyOptions = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.options.redirect_uri
    }
    const b64 = Base64.fromString(this.options.client_id + ':' + this.options.client_secret).toString();
    const tokenOptions: any = {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${b64}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: this.constructURI(bodyOptions)
    }

    // SEND A FETCH REQ FOR TOKEN
    try {
      let data: any = await fetch(this.tokenURL, tokenOptions);
      data = await data.json();

      if (data.type === 'oAuthException') {
        return new Error('ERROR in getAuthToken: Token request threw OAuth exception.');
      }

      // PASSES TOKEN ON TO STEP 4
      return this.getAuthData(data);
    } catch(err) {
      return new Error(`ERROR in getAuthToken: Unable to obtain token - ${err}`);
    }
  }

  // STEP 4 get the access token from the returned data
  // STEP 4.5 exchange access token for user info
  async getAuthData(parsed: TokenData){ 
    const authData: AuthData = {
      tokenData: {
        access_token: parsed.access_token,
        token_type: parsed.token_type,
        scope: parsed.scope,
        expires_in: parsed.expires_in,
        refresh_token: parsed.refresh_token
      },
      userInfo: {
        provider: '',
        providerUserId: ''
      }
    }

    // STEP 4.5: request user info
    const authOptions: any = {
      access_token: authData.tokenData.access_token,
      token_type: authData.tokenData.token_type,
      scope: authData.tokenData.scope,
      expires_in: authData.tokenData.expires_in,
      refresh_token: authData.tokenData.refresh_token,
    };

    try {
      let data: any = await fetch(this.authDataURL + this.constructURI(authOptions));
      data = await data.json();

      authData.userInfo = {
        provider: this.name,
        providerUserId: data.id,
      };

      return authData;
    } catch(err) {
      return new Error(`ERROR in getAuthData: Unable to obtain auth data - ${err}`);
    }
  }
}
