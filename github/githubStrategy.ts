import { OakContext, Options, AuthData, TokenData } from '../types.ts';

/** 
 * Create an instance of 'GitHubStrategy'.
 *
 * Options:
 *
 *   - client_id: string                  Required
 *   - redirect_uri: string               Required
 *   - client_secret: string              Required
 *
 * reference: https://docs.github.com/en/developers/apps/authorizing-oauth-apps
 */
export default class GitHubStrategy {
  name: string = 'github'
  options: Options;
  uriFromParams: string;
  authURL: string = 'https://github.com/login/oauth/authorize?';
  tokenURL: string = 'https://github.com/login/oauth/access_token?';
  authDataURL: string = 'https://api.github.com/user?';
  /**
   * @constructor
   * @param {Object} options
   * @api public 
   */
  constructor (options: Options) {
    // customize required/desired field for the first redirect
    if (!options.client_id || !options.redirect_uri || !options.client_secret) {
      throw new Error('ERROR in GitHubStrategy constructor: Missing required arguments');
    }

    this.options = options; 

    // PRE STEP 1: 
      // Constructs the second half of the authURL for developer's first endpoint from the info put into 'options'
    this.uriFromParams = this.constructURI(this.options);
  } 

  constructURI(options: Options, skip?: string[]): any {
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
    const decodedString: { [name: string] : string } = {
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
    const toReplaceArray: string[] = Object.keys(decodedString);

    for (let i = 0; i < toReplaceArray.length; i++) {
      while (encodedCode.includes(toReplaceArray[i])) {
        encodedCode = encodedCode.replace(toReplaceArray[i], decodedString[toReplaceArray[i]]);
      }
    }

    return encodedCode; 
  }

  // ENTRY POINT
  async router(ctx: OakContext, next: Function) {
    // GO_Step 1 Request Permission
    if (!ctx.request.url.search) return await this.authorize(ctx, next);
    // GO_Step 3 Exchange code for Token
    // ACTION REQUIRED: verify that a successful response from getAuthToken includes 'code' in the location specified below
    if (ctx.request.url.search.slice(1, 5) === 'code') return this.getAuthToken(ctx, next)
  };

  // STEP 1: sends the programatically constructed uri to an oauth 2.0 server
  async authorize(ctx: OakContext, next: Function) {
    return await ctx.response.redirect(this.authURL + this.uriFromParams);                   
  }

  // STEP 2: client choose yes or no

  // STEP 3: handle oauth 2.0 server response containing auth code
  // STEP 3.5: request access token in exchange for auth code
  async getAuthToken(ctx: OakContext, next: Function) {
    // the URI send back to the endpoint provided in step 1
    const OGURI: string = ctx.request.url.search;

    if (OGURI.includes('error')) {
      return new Error('ERROR in getAuthToken: Received an error from auth token code request.');
    }

    // splits the string at the '=,' storing the first part in URI1[0] and the part we want in URI1[1]
    let URI1: string[] = OGURI.split('=');
    // splits the string at the ampersand(&), storing the string with the access_token in URI2[0] 
    // and the other parameters at URI2[n]
    const URI2: string[] = URI1[1].split('&');
    // PARSE THE URI
    const code: string = this.parseCode(URI2[0]);

    // STEP 3.5
    // ACTION REQUIRED: add or remove the parameters needed to send as response to token request
    const tokenOptions: Options = {
      client_id: this.options.client_id,
      client_secret: this.options.client_secret,
      redirect_uri: this.options.redirect_uri,
      code: code,
    }

    // SEND A FETCH REQ FOR TOKEN
    try {
      const options: any = {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tokenOptions)
      };

      let data: any = await fetch('https://github.com/login/oauth/access_token', options);
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
        scope: parsed.scope,
        token_type: parsed.token_type,
      },
      userInfo: {
        provider: '',
        providerUserId: ''
      }
    }

    // STEP 4.5: request user info
    try {
      const authOptions: any = {
        headers: {
          'Authorization': `token ${authData.tokenData.access_token}`
        },
      };
      let data: any = await fetch('https://api.github.com/user', authOptions);
      data = await data.json();

      authData.userInfo = {
        provider: this.name,
        providerUserId: data.id,
        displayName: data.login,
        name: {
          familyName: data.name,
        },
        emails: [data.email],
      };

      return authData;
    } catch(err) {
      return new Error(`ERROR in getAuthData: Unable to obtain auth data - ${err}`);
    }
  }
}
