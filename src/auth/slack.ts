import { AuthorizationCode } from 'simple-oauth2';

if (!process.env.SLACK_CLIENT_ID) {
  throw new Error('Missing env variable: SLACK_CLIENT_ID');
}

if (!process.env.SLACK_CLIENT_SECRET) {
  throw new Error('Missing env variable: SLACK_CLIENT_SECRET');
}

interface CreateSlackOAuth2Options {
  id: string;
  secret: string;
  apiVersion?: string;
}

export const createSlackOAuth2 = ({
  id,
  secret,
  apiVersion = '',
}: CreateSlackOAuth2Options): AuthorizationCode =>
  new AuthorizationCode({
    client: { id, secret },
    auth: {
      tokenHost: 'https://slack.com',
      tokenPath: `/api/oauth.${apiVersion ? `${apiVersion}.` : ''}access`,
      authorizePath: `/oauth/${apiVersion ? `${apiVersion}/` : ''}authorize`,
    },
  });

export const slackOAuth2 = createSlackOAuth2({
  id: process.env.SLACK_CLIENT_ID,
  secret: process.env.SLACK_CLIENT_SECRET,
});

// only for apps installation
// doc: https://api.slack.com/authentication/oauth-v2
export const slackOAuth2Version2 = createSlackOAuth2({
  id: process.env.SLACK_CLIENT_ID,
  secret: process.env.SLACK_CLIENT_SECRET,
  apiVersion: 'v2',
});
