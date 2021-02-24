import { OakContext, UserProfile } from '../types.ts';

/**
 * Creates an instance of a local strategy.
 *
 * * Options:
 *
 *   - DB QUERY: string                   Required
 *   - redirect_uri: string               Required
 *   - response_type: string              Required
 *   - scope: string                      Required
 *   - access_type: string                Recommended
 *   - state: string                      Recommended
 *   - included_granted_access: string    Optional
 *   - login_hint: string                 Optional
 *   - prompt: string                     Optional
 *
 * Examples:
 * 
 *     dashport.use(new GoogleStrategy({
 *         authorizationURL: 'https://www.example.com/oauth2/authorize',
 *         tokenURL: 'https://www.example.com/oauth2/token',
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/example/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 */
interface localOptions {
  usernamefield: string;
  passwordfield: string;
  authorize: Function;
}

export default class LocalStrategy {
  name: string = 'local';
  usernameField: string;
  passwordField: string;
  _authorize: Function;
  /**
   * @constructor
   * @param {Object} options
   * @api public
   */
  constructor (options: localOptions) {
    this.usernameField = options.usernamefield;
    this.passwordField = options.passwordfield;
    this._authorize = options.authorize;
  }

  async router(ctx: OakContext, next: Function) {
    // GO_Step 1 Request Permission
    try {
      let userInfo: UserProfile = await ctx.request.body(true).value;
      userInfo = await this._authorize(userInfo);

      return { userInfo };
    } catch {
      return new Error('ERROR in router: No Username or Password submitted for authorization');
    }
  }
}
