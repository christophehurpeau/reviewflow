'use strict';

require('dotenv/config');
const probot = require('probot');
const cookieParser = require('cookie-parser');
const util = require('util');
const rest = require('@octokit/rest');
const jsonwebtoken = require('jsonwebtoken');
const React = require('react');
const server = require('react-dom/server');
const simpleOauth2 = require('simple-oauth2');
const bodyParser = require('body-parser');
const lock = require('lock');
const webApi = require('@slack/web-api');
const createEmojiRegex = require('emoji-regex');
const issueParser = require('issue-parser');
const slackifyMarkdown = require('slackify-markdown');
const parse$1 = require('@commitlint/parse');
const liwiMongo = require('liwi-mongo');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e['default'] : e; }

const cookieParser__default = /*#__PURE__*/_interopDefaultLegacy(cookieParser);
const React__default = /*#__PURE__*/_interopDefaultLegacy(React);
const bodyParser__default = /*#__PURE__*/_interopDefaultLegacy(bodyParser);
const createEmojiRegex__default = /*#__PURE__*/_interopDefaultLegacy(createEmojiRegex);
const issueParser__default = /*#__PURE__*/_interopDefaultLegacy(issueParser);
const slackifyMarkdown__default = /*#__PURE__*/_interopDefaultLegacy(slackifyMarkdown);
const parse__default = /*#__PURE__*/_interopDefaultLegacy(parse$1);

if (!process.env.GITHUB_CLIENT_ID) {
  throw new Error('Missing env variable: GITHUB_CLIENT_ID');
}

if (!process.env.GITHUB_CLIENT_SECRET) {
  throw new Error('Missing env variable: GITHUB_CLIENT_SECRET');
}

const oauth2 = new simpleOauth2.AuthorizationCode({
  client: {
    id: process.env.GITHUB_CLIENT_ID,
    secret: process.env.GITHUB_CLIENT_SECRET
  },
  auth: {
    tokenHost: 'https://github.com',
    tokenPath: '/login/oauth/access_token',
    authorizePath: '/login/oauth/authorize'
  }
});

function Layout({
  lang = 'en',
  title = process.env.REVIEWFLOW_NAME,
  children
}) {
  return /*#__PURE__*/React__default.createElement("html", {
    lang: lang
  }, /*#__PURE__*/React__default.createElement("head", null, /*#__PURE__*/React__default.createElement("meta", {
    charSet: "UTF-8"
  }), /*#__PURE__*/React__default.createElement("meta", {
    name: "robots",
    content: "noindex"
  }), /*#__PURE__*/React__default.createElement("title", null, title), /*#__PURE__*/React__default.createElement("link", {
    rel: "stylesheet",
    type: "text/css",
    href: "https://christophe.hurpeau.com/index.css"
  }), /*#__PURE__*/React__default.createElement("style", null, `html,body,html body
            #container{height:100%} footer{position:absolute;bottom:5px;left:0;right:0;}`)), /*#__PURE__*/React__default.createElement("body", null, /*#__PURE__*/React__default.createElement("div", {
    style: {
      padding: '24px 48px'
    }
  }, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("h1", null, process.env.REVIEWFLOW_NAME), children))));
}

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY;
const signPromisified = util.promisify(jsonwebtoken.sign);
const verifyPromisified = util.promisify(jsonwebtoken.verify);
const secure = !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== 'false';

const createRedirectUri$1 = req => {
  const host = `http${secure ? 's' : ''}://${req.hostname}${req.hostname === 'localhost' ? `:${process.env.PORT || 3000}` : ''}`;
  return `${host}/app/login-response`;
};

const readAuthCookie = (req, strategy) => {
  const cookie = req.cookies[`auth_${strategy}`];
  if (!cookie) return;
  return verifyPromisified(cookie, AUTH_SECRET_KEY, {
    algorithm: 'HS512',
    audience: req.headers['user-agent']
  });
};

const getAuthInfoFromCookie = async (req, res) => {
  // req.params.strategy
  try {
    const authInfo = await readAuthCookie(req, 'gh');

    if (authInfo !== null && authInfo !== void 0 && authInfo.id) {
      return authInfo;
    }
  } catch {}

  res.clearCookie(`auth_${"gh"}`);
  return undefined;
};

function createApi(accessToken) {
  return new rest.Octokit({
    auth: accessToken
  });
}

const getUser = async (req, res) => {
  const authInfo = await getAuthInfoFromCookie(req, res);

  if (!authInfo) {
    res.redirect('/app/login');
    return null;
  }

  const api = createApi(authInfo.accessToken);
  return {
    authInfo,
    api
  };
};
function auth(router) {
  router.get('/login', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      if (await getAuthInfoFromCookie(req, res)) {
        res.redirect('/app');
        return;
      } // const state = await randomHex(8);
      // res.cookie(`auth_${strategy}_${state}`, strategy, {
      //   maxAge: 10 * 60 * 1000,
      //   httpOnly: true,
      //   secure,
      // });


      const redirectUri = oauth2.authorizeURL({
        redirect_uri: createRedirectUri$1(req),
        scope: 'read:user,repo' // state,
        // grant_type: options.grantType,
        // access_type: options.accessType,
        // login_hint: req.query.loginHint,
        // include_granted_scopes: options.includeGrantedScopes,

      }); // console.log(redirectUri);

      res.redirect(redirectUri);
    } catch (err) {
      next(err);
    }
  });
  router.get('/logout', (req, res, next) => {
    try {
      res.clearCookie(`auth_${"gh"}`, {
        httpOnly: true,
        secure
      });
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, "Logout successful. ", /*#__PURE__*/React__default.createElement("a", {
        href: "/app/login"
      }, "Login")))));
    } catch (err) {
      next(err);
    }
  });
  router.get('/login-response', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      if (req.query.error) {
        res.send(req.query.error_description);
        return;
      }

      const code = req.query.code; // const state = req.query.state;
      // const cookieName = `auth_${strategy}_${state}`;
      // const cookie = req.cookies && req.cookies[cookieName];
      // if (!cookie) {
      //   // res.redirect(`/${strategy}/login`);
      //   res.send(
      //     '<html><body>No cookie for this state. <a href="/app/login">Retry ?</a></body></html>',
      //   );
      //   return;
      // }
      // res.clearCookie(cookieName);

      const accessToken = await oauth2.getToken({
        code,
        redirect_uri: createRedirectUri$1(req)
      });

      if (!accessToken) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, "Could not get access token. ", /*#__PURE__*/React__default.createElement("a", {
          href: "/app/login"
        }, "Retry ?")))));
        return;
      }

      const api = createApi(accessToken.token.access_token);
      const user = await api.users.getAuthenticated({});
      const id = user.data.id;
      const login = user.data.login;
      const authInfo = {
        id,
        login,
        accessToken: accessToken.token.access_token,
        time: Date.now()
      };
      const token = await signPromisified(authInfo, AUTH_SECRET_KEY, {
        algorithm: 'HS512',
        audience: req.headers['user-agent'],
        expiresIn: '10 days'
      });
      res.cookie(`auth_${"gh"}`, token, {
        httpOnly: true,
        secure
      });
      res.redirect('/app');
    } catch (err) {
      next(err);
    }
  });
}

function home(router) {
  router.get('/', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const orgs = await user.api.orgs.listForAuthenticatedUser();
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", {
        style: {
          display: 'flex'
        }
      }, /*#__PURE__*/React__default.createElement("div", {
        style: {
          flexGrow: 1
        }
      }, /*#__PURE__*/React__default.createElement("h4", null, "Choose your account"), /*#__PURE__*/React__default.createElement("ul", null, /*#__PURE__*/React__default.createElement("li", null, /*#__PURE__*/React__default.createElement("a", {
        href: "/app/user"
      }, user.authInfo.login)), orgs.data.map(org => /*#__PURE__*/React__default.createElement("li", {
        key: org.id
      }, /*#__PURE__*/React__default.createElement("a", {
        href: `/app/org/${org.login}`
      }, org.login)))))))));
    } catch (err) {
      next(err);
    }
  });
}

const config$3 = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(?<revert>revert: )?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\([/a-z-]+\)?((?=:\s)|(?=!:\s)))?(?<breaking>!)?(?<subject>:\s.*)$/,
      createStatusInfo: match => {
        if (match) {
          return null;
        }

        return {
          type: 'failure',
          title: 'Title does not match commitlint conventional',
          summary: 'https://www.npmjs.com/package/@commitlint/config-conventional'
        };
      }
    }]
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      tilap: 'jlavinh@gmail.com'
    }
  },
  waitForGroups: {
    dev: []
  },
  teams: {},
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFD57F'
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#B2E1FF'
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21'
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17'
      },

      /* auto merge */
      'merge/automerge': {
        name: ':vertical_traffic_light: automerge',
        color: '#64DD17'
      },
      'merge/skip-ci': {
        name: ':vertical_traffic_light: skip-ci',
        color: '#e1e8ed'
      },
      'merge/update-branch': {
        name: ':arrows_counterclockwise: update branch',
        color: '#64DD17'
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF'
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: '#ef7934'
      }
    },
    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail'
      },
      dev: {
        needsReview: 'code/needs-review',
        requested: 'code/review-requested',
        changesRequested: 'code/changes-requested',
        approved: 'code/approved'
      }
    }
  }
};

const config$2 = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: []
  },
  groups: {},
  waitForGroups: {},
  teams: {},
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: '#ef7934'
      }
    },
    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail'
      }
    }
  }
};

const config$1 = {
  autoAssignToCreator: true,
  trimTitle: true,
  ignoreRepoPattern: '(infra-.*|devenv)',
  requiresReviewRequest: true,
  autoMergeRenovateWithSkipCi: false,
  prDefaultOptions: {
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(?<revert>revert: )?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\([/A-Za-z-]+\)?((?=:\s)|(?=!:\s)))?(?<breaking>!)?(?<subject>:\s.*)$/,
      createStatusInfo: match => {
        if (match) {
          return null;
        }

        return {
          type: 'failure',
          title: 'Title does not match commitlint conventional',
          summary: 'https://www.npmjs.com/package/@commitlint/config-conventional'
        };
      }
    }, {
      regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no issue])$/,
      status: 'jira-issue',
      createStatusInfo: (match, prInfo, isPrFromBot) => {
        if (match) {
          const issue = match[1];

          if (issue === '[no issue]') {
            return {
              type: 'success',
              title: '✓ No issue',
              summary: ''
            };
          }

          return {
            type: 'success',
            inBody: true,
            title: `✓ JIRA issue: ${issue}`,
            summary: `[${issue}](https://ornikar.atlassian.net/browse/${issue})`,
            url: `https://ornikar.atlassian.net/browse/${issue}`
          };
        }

        if (isPrFromBot) {
          return {
            type: 'success',
            title: 'Title does not have Jira issue but PR created by bot',
            summary: ''
          };
        }

        return {
          type: 'failure',
          title: 'Title does not have Jira issue',
          summary: 'The PR title should end with ONK-0000, or [no issue]'
        };
      }
    }],
    head: [{
      bot: false,
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(?<revert>revert-\d+-)?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\/[a-z-]+)?\/(?<breaking>!)?(?<subject>.*)(?:-(?<jiraIssue>[A-Z][\dA-Z]+-(\d+)))?$/,
      status: 'branch-name',
      createStatusInfo: (match, {
        title
      }) => {
        const idealBranchName = title.replace(/\s*\[no issue]$/, '').replace(/\s*(\(|\):|:)\s*/g, '/').replace(/[\s,_-]+/g, '-');

        if (!match) {
          return {
            type: 'failure',
            title: `Suggested branch name: "${idealBranchName}"`,
            summary: ''
          };
        }

        if (match[0] === idealBranchName) {
          return {
            type: 'success',
            title: '✓ The branch name matches PR title',
            summary: ''
          };
        }

        return {
          type: 'success',
          title: '✓ The branch name is valid',
          summary: ''
        };
      }
    }],
    base: [{
      regExp: /^(master|main)$/,
      createStatusInfo: match => {
        if (match) {
          return null;
        }

        return {
          type: 'failure',
          title: 'PR to branches other than main is not recommended',
          summary: '',
          url: 'https://ornikar.atlassian.net/wiki/spaces/TECH/pages/2221900272/Should+I+make+a+feature-branch+or+not'
        };
      }
    }]
  },
  botUsers: ['michael-robot'],
  groups: {
    dev: {},
    design: {}
  },
  groupsGithubTeams: {
    dev: ['ops', 'dev', 'backend', 'frontend', 'frontend-architects'],
    design: ['design']
  },
  teams: {
    ops: {
      githubTeamName: 'ops',
      logins: ['JulienBreux', 'TheR3aLp3nGuinJM', 'AymenBac'],
      labels: ['teams/ops']
    },
    backends: {
      githubTeamName: 'backend',
      logins: ['abarreir', 'arthurflachs', 'damienorny', 'Thierry-girod', 'darame07', 'Pixy', 'machartier', 'camillebaronnet', 'olivier-martinez', 'tnesztler'],
      labels: ['teams/backend']
    },
    frontends: {
      githubTeamName: 'frontend',
      logins: ['christophehurpeau', 'HugoGarrido', 'LentnerStefan', 'CorentinAndre', 'Mxime', 'vlbr', 'budet-b', 'mdcarter', 'ChibiBlasphem', 'PSniezak', 'aenario', 'Goldiggy'],
      labels: ['teams/frontend']
    }
  },
  waitForGroups: {
    dev: [],
    design: ['dev']
  },
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFC44C'
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#DAE1E6'
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21'
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17'
      },

      /* design */
      'design/needs-review': {
        name: ':art: design/needs-review',
        color: '#FFC44C'
      },
      'design/review-requested': {
        name: ':art: design/review-requested',
        color: '#DAE1E6'
      },
      'design/changes-requested': {
        name: ':art: design/changes-requested',
        color: '#e11d21'
      },
      'design/approved': {
        name: ':art: design/approved',
        color: '#64DD17'
      },

      /* teams */
      'teams/ops': {
        name: 'ops',
        color: '#003b55'
      },
      'teams/backend': {
        name: 'backend',
        color: '#6ad8cb'
      },
      'teams/frontend': {
        name: 'frontend',
        color: '#8a5abc'
      },

      /* auto merge */
      'merge/automerge': {
        name: ':soon: automerge',
        color: '#64DD17'
      },
      'merge/skip-ci': {
        name: ':vertical_traffic_light: skip-ci',
        color: '#e1e8ed'
      },
      'merge/update-branch': {
        name: ':arrows_counterclockwise: update branch',
        color: '#e1e8ed'
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF'
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        description: 'This issue or pull request will need a new major version',
        color: '#FF6F00'
      },
      duplicate: {
        name: 'duplicate',
        description: 'This issue or pull request already exists',
        color: '#ECEFF1'
      },
      documentation: {
        name: 'documentation',
        description: 'Improvements or additions to documentation',
        color: '#7FCEFF'
      },
      rfc: {
        name: 'RFC',
        description: 'Request For Comments',
        color: '#FFD3B2'
      },
      bug: {
        name: 'bug',
        description: "Something isn't working",
        color: '#FF3D00'
      },
      enhancement: {
        name: 'enhancement',
        description: 'New feature or request',
        color: '#7FCEFF'
      },
      'help-wanted': {
        name: 'help wanted',
        description: 'Extra attention is needed',
        color: '#B1EE8B'
      },
      question: {
        name: 'question',
        description: 'Further information is requested',
        color: '#F860A4'
      },
      wontfix: {
        name: 'wontfix',
        description: 'This will not be worked on',
        color: '#ECEFF1'
      }
    },
    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail'
      },
      dev: {
        needsReview: 'code/needs-review',
        requested: 'code/review-requested',
        changesRequested: 'code/changes-requested',
        approved: 'code/approved'
      },
      design: {
        needsReview: 'design/needs-review',
        requested: 'design/review-requested',
        changesRequested: 'design/changes-requested',
        approved: 'design/approved'
      }
    }
  }
};

const config = { ...config$3,
  requiresReviewRequest: true,
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com'
    }
  } // parsePR: ornikarconfig.parsePR,

};

const accountConfigs = {
  ornikar: config$1,
  christophehurpeau: config$3,
  reviewflow: config
};
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };

const ExcludesFalsy = Boolean;
const ExcludesNullish = res => res !== null;

const syncOrg = async (mongoStores, octokit, installationId, org) => {
  const orgInStore = await mongoStores.orgs.upsertOne({
    _id: org.id,
    login: org.login,
    installationId
  });
  const orgEmbed = {
    id: org.id,
    login: org.login
  };
  const memberIds = [];

  for await (const {
    data
  } of octokit.paginate.iterator(octokit.orgs.listMembers, {
    org: org.login
  })) {
    await Promise.all(data.map(async member => {
      if (!member) return;
      memberIds.push(member.id);
      return Promise.all([mongoStores.orgMembers.upsertOne({
        _id: `${org.id}_${member.id}`,
        org: orgEmbed,
        user: {
          id: member.id,
          login: member.login
        }
      }, {
        teams: [] // teams is synced in syncTeamMembers

      }), mongoStores.users.upsertOne({
        _id: member.id,
        login: member.login,
        type: member.type
      })]);
    }));
  }

  await mongoStores.orgMembers.deleteMany({
    'org.id': org.id,
    'user.id': {
      $not: {
        $in: memberIds
      }
    }
  });
  return orgInStore;
};

const syncTeamMembers = async (mongoStores, octokit, org, team) => {
  const memberIds = [];

  for await (const {
    data
  } of octokit.paginate.iterator(octokit.teams.listMembersInOrg, {
    org: org.login,
    team_slug: team.slug
  })) {
    const currentIterationMemberIds = data.filter(ExcludesFalsy).map(member => member.id);
    memberIds.push(...currentIterationMemberIds);
    await mongoStores.orgMembers.partialUpdateMany({
      _id: {
        $in: currentIterationMemberIds.map(memberId => `${org.id}_${memberId}`)
      },
      'org.id': org.id,
      'teams.id': {
        $ne: team.id
      }
    }, {
      $push: {
        teams: team
      }
    });
  }

  await mongoStores.orgMembers.partialUpdateMany({
    'org.id': org.id,
    'user.id': {
      $not: {
        $in: memberIds
      }
    }
  }, {
    $pull: {
      teams: {
        id: team.id
      }
    }
  });
};

const syncTeams = async (mongoStores, octokit, org) => {
  const orgEmbed = {
    id: org.id,
    login: org.login
  };
  const teamEmbeds = [];
  const teamIds = [];

  for await (const {
    data
  } of octokit.paginate.iterator(octokit.teams.list, {
    org: org.login
  })) {
    await Promise.all(data.map(async team => {
      teamIds.push(team.id);
      teamEmbeds.push({
        id: team.id,
        name: team.name,
        slug: team.slug
      });
      return mongoStores.orgTeams.upsertOne({
        _id: team.id,
        org: orgEmbed,
        name: team.name,
        slug: team.slug,
        description: team.description
      });
    }));
  }

  await Promise.all([mongoStores.orgTeams.deleteMany({
    'org.id': org.id,
    _id: {
      $not: {
        $in: teamIds
      }
    }
  }), mongoStores.orgMembers.partialUpdateMany({
    'org.id': org.id
  }, {
    $pull: {
      teams: {
        id: {
          $not: {
            $in: teamIds
          }
        }
      }
    }
  })]);
  return teamEmbeds;
};
const syncTeamsAndTeamMembers = async (mongoStores, octokit, org) => {
  const teams = await syncTeams(mongoStores, octokit, org);

  for (const team of teams) {
    await syncTeamMembers(mongoStores, octokit, org, team);
  }
};

const syncUser = async (mongoStores, github, installationId, userInfo) => {
  const user = await mongoStores.users.upsertOne({
    _id: userInfo.id,
    login: userInfo.login,
    type: 'User',
    installationId
  });
  return user;
};

const getOrCreateAccount = async ({
  mongoStores
}, github, installationId, accountInfo) => {
  var _org, _user;

  switch (accountInfo.type) {
    case 'Organization':
      {
        let org = await mongoStores.orgs.findByKey(accountInfo.id);
        if ((_org = org) !== null && _org !== void 0 && _org.installationId) return org; // TODO diff org vs user...

        org = await syncOrg(mongoStores, github, installationId, accountInfo);
        await syncTeamsAndTeamMembers(mongoStores, github, accountInfo);
        return org;
      }

    case 'User':
      {
        let user = await mongoStores.users.findByKey(accountInfo.id);
        if ((_user = user) !== null && _user !== void 0 && _user.installationId) return user;
        user = await syncUser(mongoStores, github, installationId, accountInfo);
        return user;
      }

    default:
      throw new Error(`Account type not supported ${accountInfo.type}`);
  }
};

const defaultDmSettings = {
  'pr-lifecycle': true,
  'pr-lifecycle-follow': true,
  'pr-review': true,
  'pr-review-follow': true,
  'pr-comment': true,
  'pr-comment-bots': true,
  'pr-comment-follow': true,
  'pr-comment-follow-bots': false,
  'pr-comment-mention': true,
  'pr-comment-thread': true,
  'pr-merge-conflicts': true,
  'issue-comment-mention': true
};

const cache = new Map();

const getDefaultDmSettings = org => {
  const accountConfig = accountConfigs[org] || config$2;
  return accountConfig.defaultDmSettings ? { ...defaultDmSettings,
    ...accountConfig.defaultDmSettings
  } : defaultDmSettings;
};

const updateCache = (org, userId, newSettings) => {
  let orgCache = cache.get(org);

  if (!orgCache) {
    orgCache = new Map();
    cache.set(org, orgCache);
  }

  orgCache.set(userId, { ...getDefaultDmSettings(org),
    ...newSettings
  });
};
const getUserDmSettings = async (mongoStores, org, orgId, userId) => {
  const orgDefaultDmSettings = getDefaultDmSettings(org);
  const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
    orgId,
    userId
  });
  const config = userDmSettingsConfig ? { ...orgDefaultDmSettings,
    ...userDmSettingsConfig.settings
  } : orgDefaultDmSettings;
  updateCache(org, userId, config);
  return config;
};

const getKeys = o => Object.keys(o);
const emojiRegex = createEmojiRegex__default();
const getEmojiFromRepoDescription = description => {
  if (!description) return '';

  if (description.startsWith(':')) {
    const [, emoji] = /^(:\w+:)/.exec(description) || [];
    return emoji || '';
  }

  const match = emojiRegex.exec(description);
  if (match && description.startsWith(match[0])) return match[0];
  return '';
};

const voidTeamSlack = () => ({
  mention: () => '',
  postMessage: () => Promise.resolve(null),
  updateMessage: () => Promise.resolve(null),
  deleteMessage: () => Promise.resolve(undefined),
  addReaction: () => Promise.resolve(undefined),
  updateHome: () => undefined,
  updateSlackMember: () => Promise.resolve(undefined),
  shouldShowLoginMessage: () => false
});

async function getSlackAccountFromAccount(mongoStores, account) {
  // This is first for legacy org using their own slackToken and slack app. Keep using them.
  if ('slackToken' in account) return account.slackToken;

  if ('slackTeamId' in account) {
    const slackTeam = await mongoStores.slackTeams.findByKey(account.slackTeamId);
    return slackTeam === null || slackTeam === void 0 ? void 0 : slackTeam.botAccessToken;
  }

  return undefined;
}

const initTeamSlack = async ({
  mongoStores,
  slackHome
}, context, config, account) => {
  const slackToken = await getSlackAccountFromAccount(mongoStores, account);

  if (!slackToken) {
    return voidTeamSlack();
  } // eslint-disable-next-line unicorn/no-array-reduce, unicorn/prefer-object-from-entries -- this will be removed soon


  const githubLoginToSlackEmail = getKeys(config.groups).reduce((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});
  const slackEmails = Object.values(githubLoginToSlackEmail);
  const orgSlackClient = new webApi.WebClient(slackToken);
  const membersInDb = await mongoStores.orgMembers.findAll({
    'org.id': account._id
  });
  const members = [];
  const foundEmailMembers = [];
  Object.entries(githubLoginToSlackEmail).forEach(([login, email]) => {
    var _member$slack;

    const member = membersInDb.find(m => m.user.login === login);

    if (member !== null && member !== void 0 && (_member$slack = member.slack) !== null && _member$slack !== void 0 && _member$slack.id) {
      foundEmailMembers.push(email);
      members.push([login, {
        member: {
          id: member.slack.id
        },
        im: undefined
      }]);
    }
  });

  if (foundEmailMembers.length !== slackEmails.length) {
    const missingEmails = slackEmails.filter(email => !foundEmailMembers.includes(email));
    const memberEmailToGithubLogin = new Map(Object.entries(githubLoginToSlackEmail).map(([login, email]) => [email, login]));
    const memberEmailToMemberId = new Map(Object.entries(githubLoginToSlackEmail).map(([login, email]) => {
      var _membersInDb$find;

      return [email, (_membersInDb$find = membersInDb.find(m => m.user.login === login)) === null || _membersInDb$find === void 0 ? void 0 : _membersInDb$find._id];
    }));
    await orgSlackClient.paginate('users.list', {}, page => {
      page.members.forEach(member => {
        var _member$profile;

        const email = (_member$profile = member.profile) === null || _member$profile === void 0 ? void 0 : _member$profile.email;

        if (email && missingEmails.includes(email)) {
          const login = memberEmailToGithubLogin.get(email);
          if (!login) return;
          members.push([login, {
            member,
            im: undefined
          }]);
          const memberId = memberEmailToMemberId.get(email);

          if (memberId) {
            mongoStores.orgMembers.partialUpdateByKey(memberId, {
              $set: {
                slack: {
                  id: member.id,
                  email
                }
              }
            });
          }
        }
      });
      return false;
    });
  }

  const membersMap = new Map(members); // User added its email but not linked to a slack account yet
  // Temporary transition before login with slack in the settings

  membersInDb.forEach(member => {
    var _member$slack2;

    if (member !== null && member !== void 0 && (_member$slack2 = member.slack) !== null && _member$slack2 !== void 0 && _member$slack2.id && !membersMap.has(member.user.login)) {
      membersMap.set(member.user.login, {
        member: {
          id: member.slack.id,
          teamId: member.slack.teamId
        },
        im: undefined
      });
    }
  });

  const getSlackClient = teamId => {
    if (!teamId || !('slackTeamId' in account) || !account.slackTeamId || account.slackTeamId === teamId) {
      return orgSlackClient;
    }

    if (!account.config.canUseExternalSlack) {
      return undefined;
    } // TODO support external slack


    return undefined;
  };

  const openConversation = async (slackClient, userId) => {
    try {
      const im = await slackClient.conversations.open({
        users: userId
      });
      return im.channel;
    } catch (err) {
      context.log('could create im', {
        err
      });
    }
  };

  for (const user of membersMap.values()) {
    const slackClient = getSlackClient(user.member.teamId);

    if (slackClient) {
      user.slackClient = slackClient;
      const im = await openConversation(slackClient, user.member.id);
      if (im) user.im = im;
    }
  }

  return {
    mention: githubLogin => {
      // TODO pass AccountInfo instead
      if (githubLogin.endsWith('[bot]')) {
        return `:robot_face: ${githubLogin.slice(0, -5)}`;
      }

      const user = membersMap.get(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (category, toAccount, message) => {
      context.log.debug({
        category,
        toAccount,
        message
      }, 'slack: post message');
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;
      const userDmSettings = await getUserDmSettings(mongoStores, account.login, account._id, toAccount.id);
      if (!userDmSettings[category]) return null;
      const user = membersMap.get(toAccount.login);
      if (!user || !user.slackClient || !user.im) return null;
      const result = await user.slackClient.chat.postMessage({
        username: process.env.REVIEWFLOW_NAME,
        channel: user.im.id,
        text: message.text,
        blocks: message.blocks,
        attachments: message.secondaryBlocks ? [{
          blocks: message.secondaryBlocks
        }] : undefined,
        thread_ts: message.ts
      });
      if (!result.ok) return null;
      return {
        ts: result.ts,
        channel: result.channel
      };
    },
    updateMessage: async (toAccount, ts, channel, message) => {
      context.log.debug({
        ts,
        channel,
        message
      }, 'slack: update message');
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;
      const user = membersMap.get(toAccount.login);
      if (!user || !user.slackClient || !user.im) return null;
      const result = await user.slackClient.chat.update({
        ts,
        channel,
        text: message.text,
        blocks: message.blocks,
        attachments: message.secondaryBlocks ? [{
          blocks: message.secondaryBlocks
        }] : undefined
      });
      if (!result.ok) return null;
      return {
        ts: result.ts,
        channel: result.channel
      };
    },
    deleteMessage: async (toAccount, ts, channel) => {
      context.log.debug({
        ts,
        channel
      }, 'slack: delete message');
      const user = membersMap.get(toAccount.login);
      if (!user || !user.slackClient || !user.im) return;
      await user.slackClient.chat.delete({
        ts,
        channel
      });
    },
    addReaction: async (toAccount, ts, channel, name) => {
      context.log.debug({
        ts,
        channel,
        name
      }, 'slack: add reaction');
      const user = membersMap.get(toAccount.login);
      if (!user || !user.slackClient || !user.im) return;
      await user.slackClient.reactions.add({
        timestamp: ts,
        channel,
        name
      });
    },
    updateHome: githubLogin => {
      context.log.debug({
        githubLogin
      }, 'update slack home');
      const user = membersMap.get(githubLogin);
      if (!user || !user.slackClient || !user.member) return;
      slackHome.scheduleUpdateMember(context.octokit, user.slackClient, {
        user: {
          id: null,
          login: githubLogin
        },
        org: {
          id: account._id,
          login: account.login
        },
        slack: {
          id: user.member.id
        }
      });
    },
    updateSlackMember: async (userId, userLogin) => {
      // delete existing member if existing
      membersMap.delete(userLogin);
      const member = await mongoStores.orgMembers.findOne({
        'org.id': account._id,
        'user.id': userId
      });
      if (!member || !member.slack) return;
      const slackClient = getSlackClient(member.slack.teamId);

      if (slackClient) {
        const im = await openConversation(slackClient, member.slack.id);
        membersMap.set(userLogin, {
          member: {
            id: member.slack.id
          },
          slackClient,
          im
        });
      }
    },
    shouldShowLoginMessage: githubLogin => {
      return !membersMap.has(githubLogin);
    }
  };
};

const getTeamsAndGroups = (config, member) => {
  const {
    groupsGithubTeams,
    teams
  } = config;
  const groupName = !groupsGithubTeams ? undefined : getKeys(groupsGithubTeams).find(groupName => {
    return member.teams.some(team => {
      return groupsGithubTeams[groupName].includes(team.name);
    });
  });
  const teamNames = getKeys(teams).filter(teamName => {
    const githubTeamName = teams[teamName].githubTeamName;

    if (!githubTeamName) {
      return teams[teamName].logins.includes(member.user.login);
    }

    return member.teams.some(team => team.name === teamName);
  });
  return {
    groupName,
    teamNames
  };
};

const initAccountContext = async (appContext, context, config, accountInfo) => {
  const account = await getOrCreateAccount(appContext, context.octokit, context.payload.installation.id, accountInfo);

  const initSlack = account => initTeamSlack(appContext, context, config, account);

  const slackPromise = initSlack(account);
  const githubLoginToGroup = new Map();
  const githubTeamNameToGroup = new Map();
  const githubLoginToTeams = new Map(); // TODO const githubLoginToSlackId = new Map<string, string>();

  for (const groupName of getKeys(config.groups)) {
    Object.keys(config.groups[groupName]).forEach(login => {
      githubLoginToGroup.set(login, groupName);
    });
  }

  if (config.groupsGithubTeams) {
    for (const groupName of getKeys(config.groupsGithubTeams)) {
      config.groupsGithubTeams[groupName].forEach(teamName => {
        githubTeamNameToGroup.set(teamName, groupName);
      });
    }
  }

  const updateGithubTeamMembers = async () => {
    if (accountInfo.type !== 'Organization') {
      return;
    }

    const members = await appContext.mongoStores.orgMembers.findAll({
      'org.id': accountInfo.id
    });
    members.forEach(member => {
      const {
        groupName,
        teamNames
      } = getTeamsAndGroups(config, member);

      if (groupName) {
        githubLoginToGroup.set(member.user.login, groupName);
      }

      githubLoginToTeams.set(member.user.login, teamNames);
    });
  };

  await updateGithubTeamMembers();

  const getReviewerGroups = githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(ExcludesFalsy))];

  const getGithubTeamsGroups = githubTeamNames => [...new Set(githubTeamNames.map(teamName => githubTeamNameToGroup.get(teamName)).filter(ExcludesFalsy))];

  const lock$1 = lock.Lock();
  return {
    config,
    accountEmbed: {
      id: accountInfo.id,
      login: accountInfo.login,
      type: accountInfo.type
    },
    lock: callback => {
      return new Promise((resolve, reject) => {
        const logInfos = {
          account: accountInfo.login
        };
        context.log.info(logInfos, 'lock: try to lock account'); // eslint-disable-next-line @typescript-eslint/no-misused-promises

        lock$1('_', async createReleaseCallback => {
          const release = createReleaseCallback(() => {});
          context.log.info(logInfos, 'lock: lock account acquired');

          try {
            await callback();
          } catch (err) {
            context.log.info(logInfos, 'lock: release account (with error)');
            release();
            reject(err);
            return;
          }

          context.log.info(logInfos, 'lock: release account');
          release();
          resolve();
        });
      });
    },
    getReviewerGroup: githubLogin => githubLoginToGroup.get(githubLogin),
    getReviewerGroups,
    getTeamGroup: githubTeamName => githubTeamNameToGroup.get(githubTeamName),
    getGithubTeamsGroups,
    getTeamsForLogin: githubLogin => githubLoginToTeams.get(githubLogin) || [],
    getMembersForTeam: async teamId => {
      if (accountInfo.type !== 'Organization') {
        throw new Error(`Invalid account type "${accountInfo.type}" for getMembersForTeam`);
      }

      const cursor = await appContext.mongoStores.orgMembers.cursor({
        'org.id': account._id,
        'teams.id': teamId
      });
      await cursor.limit(100);
      const orgMembers = await cursor.toArray();
      return orgMembers.map(member => member.user);
    },
    updateGithubTeamMembers,
    approveShouldWait: (reviewerGroup, pullRequest, {
      includesReviewerGroup,
      includesWaitForGroups
    }) => {
      if (!reviewerGroup || !pullRequest.requested_reviewers || !pullRequest.requested_teams) {
        return false;
      }

      const requestedReviewerGroups = [...new Set([...getReviewerGroups(pullRequest.requested_reviewers.map(request => request.login)), ...(!pullRequest.requested_teams ? [] : getGithubTeamsGroups(pullRequest.requested_teams.map(team => team.name)))])]; // contains another request of a reviewer in the same group

      if (includesReviewerGroup && requestedReviewerGroups.includes(reviewerGroup)) {
        return true;
      } // contains a request from a dependent group


      if (config.waitForGroups && includesWaitForGroups) {
        const waitForGroups = config.waitForGroups;
        return requestedReviewerGroups.some(group => waitForGroups[reviewerGroup].includes(group));
      }

      return false;
    },
    slack: await slackPromise,

    async initSlack() {
      // get latest account
      const account = await getOrCreateAccount(appContext, context.octokit, context.payload.installation.id, accountInfo);
      const slack = await initSlack(account);
      this.slack = slack;
    }

  };
};

const accountContextsPromise = new Map();
const accountContexts = new Map();
const getExistingAccountContext = accountInfo => {
  const existingAccountContext = accountContexts.get(accountInfo.login);
  if (existingAccountContext) return Promise.resolve(existingAccountContext);
  const existingPromise = accountContextsPromise.get(accountInfo.login);
  if (existingPromise) return Promise.resolve(existingPromise);
  return null;
};
const obtainAccountContext = (appContext, context, config, accountInfo) => {
  const existingAccountContextPromise = getExistingAccountContext(accountInfo);
  if (existingAccountContextPromise) return existingAccountContextPromise;
  const promise = initAccountContext(appContext, context, config, accountInfo);
  accountContextsPromise.set(accountInfo.login, promise);
  return promise.then(accountContext => {
    accountContextsPromise.delete(accountInfo.login);
    accountContexts.set(accountInfo.login, accountContext);
    return accountContext;
  });
};

const dmMessages = {
  'pr-lifecycle': 'Your PR is closed, merged, reopened',
  'pr-lifecycle-follow': "Someone closed, merged, reopened a PR you're reviewing",
  'pr-review': 'You are assigned to a review, someone reviewed your PR',
  'pr-review-follow': "Someone reviewed a PR you're also reviewing",
  'pr-comment': 'Someone commented on your PR',
  'pr-comment-bots': 'A bot commented on your PR',
  'pr-comment-follow': "Someone commented on a PR you're reviewing",
  'pr-comment-follow-bots': "A bot commented on a PR you're reviewing",
  'pr-comment-mention': 'Someone mentioned you in a PR',
  'pr-comment-thread': "Someone replied to a discussion you're in",
  'pr-merge-conflicts': 'Your PR has a merge conflict (not implemented)',
  'issue-comment-mention': 'Someone mentioned you in an issue (not implemented)'
};
function orgSettings(router, octokitApp, mongoStores) {
  router.get('/org/:org/force-sync', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const orgs = await user.api.orgs.listForAuthenticatedUser();
      const org = orgs.data.find(o => o.login === req.params.org);

      if (!org) {
        res.redirect('/app');
        return;
      }

      const o = await mongoStores.orgs.findByKey(org.id);

      if (!o) {
        res.redirect('/app');
        return;
      }

      await syncOrg(mongoStores, user.api, o.installationId, org);
      await syncTeamsAndTeamMembers(mongoStores, user.api, org);
      res.redirect(`/app/org/${req.params.org}`);
    } catch (err) {
      next(err);
    }
  });
  router.get('/org/:org', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    const user = await getUser(req, res);

    try {
      if (!user) return;
      const authenticatedUserOrgs = await user.api.orgs.listForAuthenticatedUser();
      const org = authenticatedUserOrgs.data.find(o => o.login === req.params.org);

      if (!org) {
        res.redirect('/app');
        return;
      }

      const [installation, orgInDb] = await Promise.all([octokitApp.apps.getOrgInstallation({
        org: org.login
      }).catch(err => {
        return {
          status: err.status,
          data: undefined
        };
      }), mongoStores.orgs.findByKey(org.id)]);

      if (!orgInDb) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, process.env.REVIEWFLOW_NAME, " isn't correctly installed. Contact support."))));
        return;
      }

      const slackTeam = orgInDb.slackTeamId ? await mongoStores.slackTeams.findByKey(orgInDb.slackTeamId) : undefined;

      if (!installation) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, process.env.REVIEWFLOW_NAME, ' ', "isn't installed for this user. Go to ", /*#__PURE__*/React__default.createElement("a", {
          href: `https://github.com/settings/apps/${process.env.REVIEWFLOW_NAME}/installations/new`
        }, "Github Configuration"), ' ', "to install it."))));
        return;
      }

      const accountConfig = accountConfigs[org.login];
      const [orgMember, userDmSettings] = await Promise.all([mongoStores.orgMembers.findOne({
        'org.id': org.id,
        'user.id': user.authInfo.id
      }), getUserDmSettings(mongoStores, org.login, org.id, user.authInfo.id)]);
      const teamsAndGroups = orgMember ? getTeamsAndGroups(accountConfig, orgMember) : {
        groupName: undefined,
        teamNames: []
      };
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("div", {
        style: {
          display: 'flex'
        }
      }, /*#__PURE__*/React__default.createElement("h2", {
        style: {
          flexGrow: 1
        }
      }, org.login), /*#__PURE__*/React__default.createElement("a", {
        href: "/app"
      }, "Switch account")), /*#__PURE__*/React__default.createElement("div", {
        style: {
          display: 'flex'
        }
      }, /*#__PURE__*/React__default.createElement("div", {
        style: {
          flexGrow: 1
        }
      }, /*#__PURE__*/React__default.createElement("h4", null, "Account Config"), !accountConfig ? 'Default config is used: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/defaultConfig.ts' : `Custom config: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/${org.login}.ts`, /*#__PURE__*/React__default.createElement("h4", {
        style: {
          marginTop: '1rem'
        }
      }, "Slack Connection"), !slackTeam && !orgInDb.slackToken ? /*#__PURE__*/React__default.createElement(React__default.Fragment, null, "Slack account yet linked ! Install application to get notifications for your reviews.", /*#__PURE__*/React__default.createElement("br", null), /*#__PURE__*/React__default.createElement("a", {
        href: `/app/slack-install?orgId=${encodeURIComponent(org.id)}&orgLogin=${encodeURIComponent(org.login)}`
      }, /*#__PURE__*/React__default.createElement("img", {
        alt: "Add to Slack",
        height: "40",
        width: "139",
        src: "https://platform.slack-edge.com/img/add_to_slack.png",
        srcSet: "https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
      }))) : !orgMember || !orgMember.slack ? /*#__PURE__*/React__default.createElement(React__default.Fragment, null, /*#__PURE__*/React__default.createElement("div", null, "Slack Team: ", slackTeam === null || slackTeam === void 0 ? void 0 : slackTeam.teamName), "Slack account yet linked ! Sign in to get notifications for your reviews.", /*#__PURE__*/React__default.createElement("br", null), /*#__PURE__*/React__default.createElement("a", {
        href: `/app/slack-connect?orgId=${encodeURIComponent(org.id)}&orgLogin=${encodeURIComponent(org.login)}`
      }, /*#__PURE__*/React__default.createElement("img", {
        src: "https://api.slack.com/img/sign_in_with_slack.png",
        alt: "Sign in with Slack"
      }))) : /*#__PURE__*/React__default.createElement("div", null, !orgInDb.slackToken ? null : '⚠ This account use a custom slack application.', /*#__PURE__*/React__default.createElement("div", null, "Slack Team: ", slackTeam === null || slackTeam === void 0 ? void 0 : slackTeam.teamName, " (", orgMember.slack.teamId || (slackTeam === null || slackTeam === void 0 ? void 0 : slackTeam._id), ")"), /*#__PURE__*/React__default.createElement("div", null, "Slack User ID: ", orgMember.slack.id)), /*#__PURE__*/React__default.createElement("h4", {
        style: {
          marginTop: '1rem'
        }
      }, "User Information"), !orgMember ? /*#__PURE__*/React__default.createElement(React__default.Fragment, null, "User not found in database") : /*#__PURE__*/React__default.createElement(React__default.Fragment, null, /*#__PURE__*/React__default.createElement("div", null, "Group Name: ", teamsAndGroups.groupName || 'No groups'), /*#__PURE__*/React__default.createElement("div", null, "Team Names:", ' ', teamsAndGroups.teamNames.join(', ') || 'No teams'))), /*#__PURE__*/React__default.createElement("div", {
        style: {
          width: '380px'
        }
      }, /*#__PURE__*/React__default.createElement("h4", null, "My DM Settings"), !orgMember || !orgMember.slack ? /*#__PURE__*/React__default.createElement(React__default.Fragment, null, "Link your github account to unlock DM Settings") : Object.entries(dmMessages).map(([key, name]) => /*#__PURE__*/React__default.createElement("div", {
        key: key
      }, /*#__PURE__*/React__default.createElement("label", {
        htmlFor: key
      }, /*#__PURE__*/React__default.createElement("span", {
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML: {
          __html: `<input id="${key}" type="checkbox" autocomplete="off" ${userDmSettings[key] ? 'checked="checked" ' : ''}onclick="fetch(location.pathname, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '${key}', value: event.currentTarget.checked }) })" />`
        }
      }), name)))))))));
    } catch (err) {
      next(err);
    }
  });
  router.patch('/org/:org', bodyParser__default.json(), async (req, res, next) => {
    try {
      if (!req.body) {
        res.status(400).send('not ok');
        return;
      }

      const user = await getUser(req, res);
      if (!user) return;
      const orgs = await user.api.orgs.listForAuthenticatedUser();
      const org = orgs.data.find(o => o.login === req.params.org);

      if (!org) {
        res.redirect('/app');
        return;
      }

      (await mongoStores.userDmSettings.collection).updateOne({
        _id: `${org.id}_${user.authInfo.id}`
      }, {
        $set: {
          [`settings.${req.body.key}`]: req.body.value,
          updated: new Date()
        },
        $setOnInsert: {
          orgId: org.id,
          userId: user.authInfo.id,
          created: new Date()
        }
      }, {
        upsert: true
      });
      const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
        orgId: org.id,
        userId: user.authInfo.id
      });

      if (userDmSettingsConfig) {
        updateCache(org.login, user.authInfo.id, userDmSettingsConfig.settings);
      }

      res.send('ok');
    } catch (err) {
      next(err);
    }
  });
}

function repository(router, octokitApp) {
  router.get('/repositories', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const {
        data
      } = await user.api.repos.listForAuthenticatedUser({
        per_page: 100
      });
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("h4", null, "Your repositories"), /*#__PURE__*/React__default.createElement("ul", null, data.map(repo => /*#__PURE__*/React__default.createElement("li", {
        key: repo.id
      }, /*#__PURE__*/React__default.createElement("a", {
        href: `/app/repository/${repo.owner.login}/${repo.name}`
      }, repo.name)))), data.length === 100 && /*#__PURE__*/React__default.createElement("div", null, "We currently have a limit to 100 repositories")))));
    } catch (err) {
      next(err);
    }
  });
  router.get('/repository/:owner/:repository', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const {
        data
      } = await user.api.repos.get({
        owner: req.params.owner,
        repo: req.params.repository
      });

      if (!data) {
        res.status(404).send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, "repo not found"))));
        return;
      }

      if (!data.permissions || !data.permissions.admin) {
        res.status(401).send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, "not authorized to see this repo, you need to have admin permission"))));
        return;
      }

      const {
        data: data2
      } = await octokitApp.apps.getRepoInstallation({
        owner: req.params.owner,
        repo: req.params.repository
      }).catch(err => {
        return {
          status: err.status,
          data: undefined
        };
      });

      if (!data2) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, process.env.REVIEWFLOW_NAME, ' ', "isn't installed on this repo. Go to ", /*#__PURE__*/React__default.createElement("a", {
          href: `https://github.com/apps/${process.env.REVIEWFLOW_NAME}/installations/new`
        }, "Github Configuration"), ' ', "to add it."))));
        return;
      }

      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("h4", null, req.params.repository)))));
    } catch (err) {
      next(err);
    }
  });
}

if (!process.env.SLACK_CLIENT_ID) {
  throw new Error('Missing env variable: SLACK_CLIENT_ID');
}

if (!process.env.SLACK_CLIENT_SECRET) {
  throw new Error('Missing env variable: SLACK_CLIENT_SECRET');
}

const createSlackOAuth2 = ({
  id,
  secret,
  apiVersion = ''
}) => new simpleOauth2.AuthorizationCode({
  client: {
    id,
    secret
  },
  auth: {
    tokenHost: 'https://slack.com',
    tokenPath: `/api/oauth.${apiVersion ? `${apiVersion}.` : ''}access`,
    authorizePath: `/oauth/${apiVersion ? `${apiVersion}/` : ''}authorize`
  }
});
const slackOAuth2 = createSlackOAuth2({
  id: process.env.SLACK_CLIENT_ID,
  secret: process.env.SLACK_CLIENT_SECRET
}); // only for apps installation
// doc: https://api.slack.com/authentication/oauth-v2

const slackOAuth2Version2 = createSlackOAuth2({
  id: process.env.SLACK_CLIENT_ID,
  secret: process.env.SLACK_CLIENT_SECRET,
  apiVersion: 'v2'
});

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const createRedirectUri = req => {
  const host = `https://${req.hostname}${req.hostname === 'localhost' ? `:${process.env.PORT || 3000}` : ''}`;
  return `${host}/app/slack-connect-response`;
};

const parseJSONSafe = string => {
  try {
    return JSON.parse(string);
  } catch {
    return null;
  }
};

function slackConnect(router, mongoStores) {
  router.get('/slack-connect', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const orgId = Number(req.query.orgId);
      const orgLogin = req.query.orgLogin;

      if (!orgId || !orgLogin) {
        res.redirect('/app');
        return;
      }

      const org = await mongoStores.orgs.findByKey(orgId);

      if (!org || !org.slackTeamId) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Organization is not installed.")));
        return;
      }

      const redirectUri = slackOAuth2.authorizeURL({
        redirect_uri: createRedirectUri(req),
        scope: 'identity.basic identity.email identity.avatar',
        state: JSON.stringify({
          orgId,
          orgLogin
        }),
        team: org.slackTeamId
      });
      res.redirect(redirectUri);
    } catch (err) {
      next(err);
    }
  }); // see url in https://app.slack.com/app-settings/T01495JH7RS/A023QGDUDQX/distribute for scopes

  const slackInstallAppScopes = 'chat:write,im:history,im:read,im:write,mpim:history,mpim:read,mpim:write,reactions:read,reactions:write,team:read,users:read,users:read.email,users:write';
  router.get('/slack-install', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;
      const orgId = Number(req.query.orgId);
      const orgLogin = req.query.orgLogin;

      if (!orgId || !orgLogin) {
        res.redirect('/app');
        return;
      }

      const redirectUri = slackOAuth2Version2.authorizeURL({
        redirect_uri: createRedirectUri(req),
        scope: slackInstallAppScopes,
        state: JSON.stringify({
          orgId,
          orgLogin,
          isInstall: true
        })
      });
      res.redirect(redirectUri);
    } catch (err) {
      next(err);
    }
  });
  router.get('/slack-connect-response', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    var _accessToken$token, _accessToken$token2, _accessToken$token2$t;

    try {
      const user = await getUser(req, res);
      if (!user) return;

      if (req.query.error) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Could not get access token:", ' ', req.query.error_description || req.query.error, ".")));
        return;
      }

      const code = req.query.code;
      const state = req.query.state;
      const {
        orgId,
        orgLogin,
        isInstall
      } = parseJSONSafe(state) || {};
      const accessToken = await (isInstall ? slackOAuth2Version2 : slackOAuth2).getToken({
        code,
        redirect_uri: createRedirectUri(req),
        scope: isInstall ? slackInstallAppScopes : undefined
      });

      if (!accessToken || !accessToken.token.ok) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Could not get access token (Error:", ' ', (accessToken === null || accessToken === void 0 ? void 0 : (_accessToken$token = accessToken.token) === null || _accessToken$token === void 0 ? void 0 : _accessToken$token.error) || 'Unknown', ").", /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("a", {
          href: `/app/org/${orgLogin || ''}`
        }, "Back")))));
        return;
      }

      const org = await mongoStores.orgs.findByKey(orgId);

      if (!org) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Organization is not installed.", /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("a", {
          href: `/app/org/${orgLogin || ''}`
        }, "Back")))));
        return;
      } // install slack, not login


      if (isInstall) {
        if (!((_accessToken$token2 = accessToken.token) !== null && _accessToken$token2 !== void 0 && (_accessToken$token2$t = _accessToken$token2.team) !== null && _accessToken$token2$t !== void 0 && _accessToken$token2$t.id)) {
          res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Invalid token: no team id.", /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("a", {
            href: `/app/org/${orgLogin || ''}`
          }, "Back")))));
          return;
        }

        const slackTeam = {
          _id: accessToken.token.team.id,
          teamName: accessToken.token.team.name,
          appId: accessToken.token.app_id,
          installerUserId: accessToken.token.authed_user.id,
          botUserId: accessToken.token.bot_user_id,
          botAccessToken: accessToken.token.access_token,
          scope: accessToken.token.scope ? accessToken.token.scope.split(',') : []
        };
        await Promise.all([mongoStores.slackTeams.insertOne(slackTeam), mongoStores.slackTeamInstallations.insertOne({ ...slackTeam,
          teamId: slackTeam._id,
          _id: undefined
        }), mongoStores.orgs.partialUpdateOne(org, {
          $set: {
            slackTeamId: slackTeam._id
          }
        })]);
        const existingAccountContext = await getExistingAccountContext({
          type: 'Organization',
          id: orgId,
          login: orgLogin
        });

        if (existingAccountContext) {
          existingAccountContext.initSlack();
        }

        res.redirect(`/app/org/${orgLogin || ''}`);
        return;
      }

      const slackClient = new webApi.WebClient(accessToken.token.access_token);
      const identity = await slackClient.users.identity();

      if (!org.slackTeamId && !org.slackToken) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Organization is not linked to slack. Install it first.", /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("a", {
          href: `/app/org/${orgLogin || ''}`
        }, "Back")))));
        return;
      }

      if (org !== null && org !== void 0 && org.slackTeamId && accessToken.token.team_id !== (org === null || org === void 0 ? void 0 : org.slackTeamId)) {
        res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, "Invalid slack team.", ' ', /*#__PURE__*/React__default.createElement("a", {
          href: `/app/slack-connect?orgId=${encodeURIComponent(org._id)}&orgLogin=${encodeURIComponent(org.login)}`
        }, "Retry ?"))));
        return;
      }

      await mongoStores.orgMembers.partialUpdateMany({
        'user.id': user.authInfo.id,
        'org.id': orgId
      }, {
        $set: {
          slack: {
            id: accessToken.token.user_id,
            accessToken: accessToken.token.access_token,
            scope: accessToken.token.scope ? accessToken.token.scope.split(',') : [],
            teamId: accessToken.token.team_id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            email: identity.user.email
          }
        }
      });
      const existingAccountContext = await getExistingAccountContext({
        type: 'Organization',
        id: orgId,
        login: orgLogin
      });

      if (existingAccountContext) {
        existingAccountContext.slack.updateSlackMember(user.authInfo.id, user.authInfo.login);
      }

      res.redirect(`/app/org/${orgLogin || ''}`);
    } catch (err) {
      next(err);
    }
  });
}

function userSettings(router, octokitApp, mongoStores) {
  router.get('/user/force-sync', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return; // const { data: installation } = await api.apps
      //   .getUserInstallation({
      //     username: user.authInfo.login,
      //   })
      //   .catch((err) => {
      //     return { status: err.status, data: undefined };
      //   });
      // console.log(installation);

      const u = await mongoStores.users.findByKey(user.authInfo.id);

      if (!u || !u.installationId) {
        res.redirect('/app');
        return;
      }

      await syncUser(mongoStores, user.api, u.installationId, user.authInfo);
      res.redirect('/app/user');
    } catch (err) {
      next(err);
    }
  });
  router.get('/user', // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return null;
      const {
        data: installation
      } = await octokitApp.apps.getUserInstallation({
        username: user.authInfo.login
      }).catch(err => {
        return {
          status: err.status,
          data: undefined
        };
      });

      if (!installation) {
        return res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, process.env.REVIEWFLOW_NAME, ' ', "isn't installed for this user. Go to ", /*#__PURE__*/React__default.createElement("a", {
          href: `https://github.com/settings/apps/${process.env.REVIEWFLOW_NAME}/installations/new`
        }, "Github Configuration"), ' ', "to install it."))));
      }

      return res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, process.env.REVIEWFLOW_NAME, " is installed for this user"))));
    } catch (err) {
      next(err);
      return null;
    }
  });
}

async function appRouter(app, getRouter, {
  mongoStores
}) {
  const router = getRouter('/app');
  const octokitApp = await app.auth();
  router.use(cookieParser__default());
  auth(router);
  repository(router, octokitApp);
  home(router);
  orgSettings(router, octokitApp, mongoStores);
  userSettings(router, octokitApp, mongoStores);
  slackConnect(router, mongoStores);
}

const handlerOrgChange = async (appContext, context, callback) => {
  const org = context.payload.organization;
  if (!org) return;
  const config = accountConfigs[org.login] || config$2;
  const accountContext = await obtainAccountContext(appContext, context, config, { ...org,
    type: 'Organization'
  });
  if (!accountContext) return;
  return accountContext.lock(async () => {
    await callback(context, accountContext);
  });
};
const createHandlerOrgChange = (appContext, callback) => context => {
  return handlerOrgChange(appContext, context, callback);
};

function membershipChanged(app, appContext) {
  /* https://developer.github.com/webhooks/event-payloads/#membership */
  app.on(['membership.added', 'membership.removed'], createHandlerOrgChange(appContext, async (context, accountContext) => {
    // TODO: only sync team members and team parents members
    // await syncTeamMembersWithTeamParents(
    //   appContext.mongoStores,
    //   context.octokit,
    //   context.payload.organization,
    //   {
    //     id: context.payload.team.id,
    //     name: context.payload.team.name,
    //     slug: context.payload.team.slug,
    //   },
    // );
    await syncTeamsAndTeamMembers(appContext.mongoStores, context.octokit, context.payload.organization);
    await accountContext.updateGithubTeamMembers();
  }));
}

function orgMemberAddedOrRemoved(app, appContext) {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(['organization.member_added', 'organization.member_removed'], createHandlerOrgChange(appContext, async (context, accountContext) => {
    const o = await appContext.mongoStores.orgs.findByKey(accountContext.accountEmbed.id);
    if (!o || !o.installationId) return;
    await syncOrg(appContext.mongoStores, context.octokit, o.installationId, context.payload.organization);
  }));
}

function teamChanged(app, appContext) {
  /* https://developer.github.com/webhooks/event-payloads/#team */
  app.on(['team.created', 'team.deleted', 'team.edited'], createHandlerOrgChange(appContext, async context => {
    await syncTeams(appContext.mongoStores, context.octokit, context.payload.organization);
  }));
}

const checkIfUserIsBot = (repoContext, user) => {
  if (user.type === 'Bot') return true;

  if (repoContext.config.botUsers) {
    return repoContext.config.botUsers.includes(user.login);
  }

  return false;
};
const checkIfIsThisBot = user => {
  return user.type === 'Bot' && user.login === `${process.env.REVIEWFLOW_NAME}[bot]`;
};
const areCommitsAllMadeByBots = (repoContext, commits) => commits.every(c => c.author && checkIfUserIsBot(repoContext, c.author));

const updateBranch = async (pullRequest, context, login) => {
  var _result$data;

  context.log.info('update branch', {
    head: pullRequest.head.ref,
    base: pullRequest.base.ref
  });
  const result = await context.octokit.repos.merge({
    owner: pullRequest.head.repo.owner.login,
    repo: pullRequest.head.repo.name,
    head: pullRequest.base.ref,
    base: pullRequest.head.ref
  }).catch(err => ({
    error: err
  }));
  context.log.info({
    status: result.status,
    sha: (_result$data = result.data) === null || _result$data === void 0 ? void 0 : _result$data.sha,
    error: result.error
  }, 'update branch result');

  if (result.status === 204) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `${login ? `@${login} ` : ''}Could not update branch: base already contains the head, nothing to merge.`
    }));
    return true;
  } else if (result.status === 409) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `${login ? `@${login} ` : ''}Could not update branch: merge conflict. Please resolve manually.`
    }));
    return false;
  } else if (!result || !result.data || !result.data.sha) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `${login ? `@${login} ` : ''}Could not update branch (unknown error).`
    }));
    return false;
  } else if (login) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `${login ? `@${login} ` : ''}Branch updated: ${result.data.sha}`
    }));
  }

  return true;
};

const options = ['autoMerge', 'autoMergeWithSkipCi', 'deleteAfterMerge'];
const optionsRegexps = options.map(option => ({
  key: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`)
}));
const optionsDescriptions = [{
  key: 'autoMerge',
  labelKey: 'merge/automerge',
  description: 'Automatically merge when this PR is ready and has no failed statuses. When the repository requires _branches to be up to date before merging_, it merges default branch, with a queue per repo to prevent multiple merges when several PRs are ready. A fail job prevents the merge.'
}, {
  key: 'autoMergeWithSkipCi',
  labelKey: 'merge/skip-ci',
  description: 'Add `[skip ci]` on merge commit when merge is done with autoMerge.'
}, {
  key: 'deleteAfterMerge',
  icon: ':recycle:',
  description: 'Automatically delete the branch after this PR is merged.'
}];

const parseOptions = (content, defaultOptions) => {
  const options = {};
  optionsRegexps.forEach(({
    key,
    regexp
  }) => {
    const match = regexp.exec(content);
    options[key] = !match ? defaultOptions[key] || false : match[1] === 'x' || match[1] === 'X';
  });
  return options;
};
const parseCommitNotes = content => {
  const commitNotes = content.replace(/^.*#### Commits Notes:(.*)#### Options:.*$/s, '$1');

  if (commitNotes === content) {
    return '';
  } else {
    return commitNotes.trim();
  }
};
const parseBody = (content, defaultOptions) => {
  return {
    options: parseOptions(content, defaultOptions),
    commitNotes: parseCommitNotes(content)
  };
};

function hasLabelInPR(prLabels, label) {
  if (!label) return false;
  return prLabels.some(l => l.id === label.id);
}

function readPullRequestCommits(context, pr = context.payload.pull_request) {
  return context.octokit.paginate(context.octokit.pulls.listCommits, context.repo({
    pull_number: pr.number,
    // A custom page size up to 100. Default is 30.
    per_page: 100
  }), res => res.data);
}

/* eslint-disable max-lines */

const hasFailedStatusOrChecks = async (pr, context) => {
  const checks = await context.octokit.checks.listForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));
  const failedChecks = checks.data.check_runs.filter(check => check.conclusion === 'failure');

  if (failedChecks.length > 0) {
    context.log.info({
      checks: failedChecks.map(check => check.name)
    }, `automerge not possible: failed check pr ${pr.id}`);
    return true;
  }

  const combinedStatus = await context.octokit.repos.getCombinedStatusForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));

  if (combinedStatus.data.state === 'failure') {
    const failedStatuses = combinedStatus.data.statuses.filter(status => status.state === 'failure' || status.state === 'error');
    context.log.info({
      statuses: failedStatuses.map(status => status.context)
    }, `automerge not possible: failed status pr ${pr.id}`);
    return true;
  }

  return false;
};

const autoMergeIfPossible = async (pullRequest, context, repoContext, reviewflowPrContext, prLabels = pullRequest.labels) => {
  if (reviewflowPrContext === null) return false;
  const autoMergeLabel = repoContext.labels['merge/automerge'];

  if (!hasLabelInPR(prLabels, autoMergeLabel)) {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'no automerge label');
    return false;
  }

  const isRenovatePr = pullRequest.head.ref.startsWith('renovate/');

  const createMergeLockPrFromPr = () => ({
    id: pullRequest.id,
    number: pullRequest.number,
    branch: pullRequest.head.ref
  });

  if (pullRequest.state !== 'open') {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'pr is not opened');
    return false;
  }

  const addLog = (type, action) => {
    const repoFullName = pullRequest.head.repo.full_name;
    context.log.info(`automerge: ${repoFullName}#${pullRequest.id} ${type}`);
    repoContext.appContext.mongoStores.automergeLogs.insertOne({
      account: repoContext.accountEmbed,
      repoFullName,
      pr: {
        id: pullRequest.id,
        number: pullRequest.number,
        isRenovate: isRenovatePr,
        mergeableState: pullRequest.mergeable_state
      },
      type,
      action
    });
  };

  if (repoContext.hasNeedsReview(prLabels) || repoContext.hasRequestedReview(prLabels)) {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'blocking labels');
    return false;
  }

  if (pullRequest.requested_reviewers && pullRequest.requested_reviewers.length > 0) {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'still has requested reviewers');
    return false;
  }

  if (pullRequest.requested_teams && pullRequest.requested_teams.length > 0) {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'still has requested teams');
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();

  if (lockedPr && String(lockedPr.number) !== String(pullRequest.number)) {
    context.log.info({
      prId: pullRequest.id,
      prNumber: pullRequest.number,
      lockedPrNumber: lockedPr.number
    }, 'automerge not possible: locked pr');
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pullRequest.mergeable == null) {
    const prResult = await context.octokit.pulls.get(context.repo({
      pull_number: pullRequest.number
    }));
    pullRequest = prResult.data;
  }

  if (pullRequest.merged) {
    addLog('already merged', 'remove');
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'pr already merged');
    return false;
  }

  context.log.info(`automerge?: ${pullRequest.id}, #${pullRequest.number}, mergeable=${pullRequest.mergeable} state=${pullRequest.mergeable_state}`); // https://github.com/octokit/octokit.net/issues/1763

  if (!(pullRequest.mergeable_state === 'clean' || pullRequest.mergeable_state === 'has_hooks' || pullRequest.mergeable_state === 'unstable')) {
    if (!pullRequest.mergeable_state || pullRequest.mergeable_state === 'unknown') {
      addLog('unknown mergeable_state', 'reschedule'); // GitHub is determining whether the pull request is mergeable

      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (isRenovatePr) {
      if (pullRequest.mergeable_state === 'behind' || pullRequest.mergeable_state === 'dirty') {
        const commits = await readPullRequestCommits(context, pullRequest); // check if has commits not made by renovate or bots like https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120

        if (!areCommitsAllMadeByBots(repoContext, commits)) {
          addLog('rebase-renovate', 'update branch');

          if (await updateBranch(pullRequest, context, null)) {
            return false;
          }

          repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'update branch failed');
          return false;
        }

        addLog('rebase-renovate', 'wait');

        if (pullRequest.body && pullRequest.body.includes('<!-- rebase-check -->')) {
          if (pullRequest.body.includes('[x] <!-- rebase-check -->')) {
            return false;
          }

          const renovateRebaseBody = pullRequest.body.replace('[ ] <!-- rebase-check -->', '[x] <!-- rebase-check -->');
          await context.octokit.issues.update(context.repo({
            issue_number: pullRequest.number,
            body: renovateRebaseBody
          }));
        } else if (!pullRequest.title.startsWith('rebase!')) {
          await context.octokit.issues.update(context.repo({
            issue_number: pullRequest.number,
            title: `rebase!${pullRequest.title}`
          }));
        }

        return false;
      }

      if (await hasFailedStatusOrChecks(pullRequest, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'failed status or checks');
        return false;
      } else if (pullRequest.mergeable_state === 'blocked') {
        addLog('blocked mergeable_state', 'wait'); // waiting for reschedule in status (pr-handler/status.ts)

        return false;
      }

      context.log.info(`automerge not possible: renovate with mergeable_state=${pullRequest.mergeable_state}`);
      return false;
    }

    if (pullRequest.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(pullRequest, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'failed status or checks');
        return false;
      } else {
        addLog('blocked mergeable_state', 'wait'); // waiting for reschedule in status (pr-handler/status.ts)

        return false;
      }
    }

    if (pullRequest.mergeable_state === 'behind') {
      addLog('behind mergeable_state', 'update branch');

      if (await updateBranch(pullRequest, context, null)) {
        return false;
      }

      repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'update branch failed');
      return false;
    }

    addLog('not mergeable', 'remove');
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, `mergeable_state=${pullRequest.mergeable_state}`);
    context.log.info(`automerge not possible: not mergeable mergeable_state=${pullRequest.mergeable_state}`);
    return false;
  }

  try {
    context.log.info(`automerge pr #${pullRequest.number}`);
    const parsedBody = parseBody(reviewflowPrContext.commentBody, repoContext.config.prDefaultOptions);
    const options = (parsedBody === null || parsedBody === void 0 ? void 0 : parsedBody.options) || repoContext.config.prDefaultOptions;
    const mergeResult = await context.octokit.pulls.merge({
      merge_method: 'squash',
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
      commit_title: `${pullRequest.title}${options.autoMergeWithSkipCi ? ' [skip ci]' : ''} (#${pullRequest.number})`,
      commit_message: parsedBody !== null && parsedBody !== void 0 && parsedBody.commitNotes ? parsedBody === null || parsedBody === void 0 ? void 0 : parsedBody.commitNotes.replace(/^- (.*)\s*\([^)]+\)$/gm, '$1').replace(/^Breaking Changes:\n/, 'BREAKING CHANGE: ').replace(/\n/g, '; ') : ''
    });
    context.log.debug(mergeResult.data, 'merge result:');
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'merged');
    return Boolean('merged' in mergeResult.data && mergeResult.data.merged);
  } catch (err) {
    context.log.info({
      errorMessage: err.message
    }, 'could not merge:');
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};

const defaultCommentBody = 'This will be auto filled by reviewflow.';

const toMarkdownOptions = (repoLink, labelsConfig, options) => {
  return optionsDescriptions.map(({
    key,
    labelKey,
    description,
    icon: iconValue
  }) => {
    const checkboxWithId = `[${options[key] ? 'x' : ' '}] <!-- reviewflow-${key} -->`;
    const labelDescription = labelKey && labelsConfig[labelKey];
    const labelLink = labelDescription ? `[${labelDescription.name}](${repoLink}/labels/${encodeURIComponent(labelDescription.name)}): ` : '';
    const icon = labelLink || !iconValue ? '' : `${iconValue} `;
    return `- ${checkboxWithId}${icon}${labelLink}${description}`;
  }).join('\n');
};

const toMarkdownInfos = infos => {
  return infos.map(info => {
    if (info.url) return `[${info.title}](${info.url})`;
    return info.title;
  }).join('\n\n');
};

const getReplacement = infos => {
  if (!infos) return '$1$2';
  return infos.length > 0 ? `#### Infos:\n\n${toMarkdownInfos(infos)}\n\n$2` : '$2';
};

const updateOptions = (options, optionsToUpdate) => {
  if (!optionsToUpdate) return options;
  return { ...options,
    ...optionsToUpdate
  };
};

const internalUpdateBodyOptionsAndInfos = (repoLink, labelsConfig, body, options, infos) => {
  const infosAndCommitNotesParagraph = body.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /^\s*(?:(#### Infos:.*)?(#### Commits Notes:.*)?#### Options:)?.*$/s, getReplacement(infos));
  return `${infosAndCommitNotesParagraph}#### Options:\n${toMarkdownOptions(repoLink, labelsConfig, options)}`;
};

const createCommentBody = (repoLink, labelsConfig, defaultOptions, infos) => {
  return internalUpdateBodyOptionsAndInfos(repoLink, labelsConfig, '', defaultOptions, infos);
};
const updateCommentOptions = (repoLink, labelsConfig, commentBody, defaultOptions, optionsToUpdate) => {
  const options = parseOptions(commentBody, defaultOptions);
  const updatedOptions = updateOptions(options, optionsToUpdate);
  return {
    options: updatedOptions,
    commentBody: internalUpdateBodyOptionsAndInfos(repoLink, labelsConfig, commentBody, updatedOptions)
  };
};
const updateCommentBodyInfos = (commentBody, infos) => {
  return commentBody.replace( // *  - zero or more
  // *? - zero or more (non-greedy)
  // eslint-disable-next-line unicorn/no-unsafe-regex
  /^\s*(?:(#### Infos:.*?)?(#### Commits Notes:.*?)?(#### Options:.*?)?)?$/s, `${getReplacement(infos)}$3`);
};
const updateCommentBodyCommitsNotes = (commentBody, commitNotes) => {
  return commentBody.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /(?:#### Commits Notes:.*?)?(#### Options:)/s, !commitNotes ? '$1' : `#### Commits Notes:\n\n${commitNotes}\n\n$1`);
};
const removeDeprecatedReviewflowInPrBody = prBody => {
  if (!prBody) return '';
  return prBody.replace(/^(.*)<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->(.*)$/is, '$1$3');
};

const createReviewflowComment = (pullRequestNumber, context, body) => {
  return context.octokit.issues.createComment(context.repo({
    issue_number: pullRequestNumber,
    body
  })).then(({
    data
  }) => data);
};
const getReviewflowCommentById = (pullRequestNumber, context, commentId) => {
  return context.octokit.issues.getComment(context.repo({
    issue_number: pullRequestNumber,
    comment_id: commentId
  })).then(({
    data
  }) => data, () => null);
};

const getReviewflowPrContext = async (pullRequestNumber, context, repoContext, reviewflowCommentPromise) => {
  const appContext = repoContext.appContext;
  const prEmbed = {
    number: pullRequestNumber
  };

  if (reviewflowCommentPromise) {
    const comment = await reviewflowCommentPromise;
    const reviewflowPr = await appContext.mongoStores.prs.insertOne({
      account: repoContext.accountEmbed,
      repo: repoContext.repoEmbed,
      pr: prEmbed,
      commentId: comment.id
    });
    return {
      reviewflowPr,
      commentBody: comment.body
    };
  }

  const existing = await appContext.mongoStores.prs.findOne({
    'account.id': repoContext.accountEmbed.id,
    'repo.id': repoContext.repoEmbed.id,
    'pr.number': pullRequestNumber
  });
  const comment = existing && (await getReviewflowCommentById(pullRequestNumber, context, existing.commentId));

  if (!comment || !existing) {
    const comment = await createReviewflowComment(pullRequestNumber, context, defaultCommentBody);

    if (!existing) {
      const reviewflowPr = await appContext.mongoStores.prs.insertOne({
        account: repoContext.accountEmbed,
        repo: repoContext.repoEmbed,
        pr: prEmbed,
        commentId: comment.id
      });
      return {
        reviewflowPr,
        commentBody: comment.body
      };
    } else {
      await appContext.mongoStores.prs.partialUpdateByKey(existing._id, {
        $set: {
          commentId: comment.id
        }
      });
    }
  }

  return {
    reviewflowPr: existing,
    commentBody: comment.body
  };
};

const fetchPr = async (context, prNumber) => {
  const prResult = await context.octokit.pulls.get(context.repo({
    pull_number: prNumber
  }));
  return prResult.data;
};

const getLabelsForRepo = async context => {
  const {
    data: labels
  } = await context.octokit.issues.listLabelsForRepo(context.repo({
    per_page: 100
  }));
  return labels;
};
const initRepoLabels = async (context, config) => {
  const labels = await getLabelsForRepo(context);
  const finalLabels = {};

  for (const [labelKey, labelConfig] of Object.entries(config.labels.list)) {
    const labelColor = labelConfig.color.slice(1);
    const description = labelConfig.description ? `${labelConfig.description} - Synced by reviewflow` : `Synced by reviewflow for ${labelKey}`;
    let existingLabel = labels.find(label => label.name === labelConfig.name);

    if (!existingLabel) {
      existingLabel = labels.find(label => label.description === description);
    }

    if (!existingLabel) {
      if (labelKey === 'design/needs-review') {
        existingLabel = labels.find(label => label.name === 'needs-design-review');
      }

      if (labelKey === 'design/approved') {
        existingLabel = labels.find(label => label.name === 'design-reviewed');
      }

      if (labelKey === 'teams/ops') {
        existingLabel = labels.find(label => label.name === 'archi');
      }

      if (labelKey === 'merge/skip-ci') {
        existingLabel = labels.find(label => label.name === 'automerge/skip-ci');
      }
    }

    if (!existingLabel) {
      const result = await context.octokit.issues.createLabel(context.repo({
        name: labelConfig.name,
        color: labelColor,
        description
      }));
      finalLabels[labelKey] = result.data;
    } else if (existingLabel.name !== labelConfig.name || existingLabel.color !== labelColor || existingLabel.description !== description) {
      context.log.info({
        current_name: existingLabel.name,
        name: existingLabel.name !== labelConfig.name && labelConfig.name,
        color: existingLabel.color !== labelColor && labelColor,
        description: existingLabel.description !== description && description
      }, 'Needs to update label');
      const result = await context.octokit.issues.updateLabel(context.repo({
        name: existingLabel.name,
        new_name: labelConfig.name,
        color: labelColor,
        description
      }));
      finalLabels[labelKey] = result.data;
    } else {
      finalLabels[labelKey] = existingLabel;
    }
  }

  return finalLabels;
};

const shouldIgnoreRepo = (repoName, accountConfig) => {
  const ignoreRepoRegexp = accountConfig.ignoreRepoPattern && new RegExp(`^${accountConfig.ignoreRepoPattern}$`);

  if (repoName === 'reviewflow-test') {
    return process.env.REVIEWFLOW_NAME !== 'reviewflow-dev';
  }

  if (ignoreRepoRegexp) {
    return ignoreRepoRegexp.test(repoName);
  }

  return false;
};

const createGetReviewLabelIds = (shouldIgnore, config, reviewGroupNames, labels) => {
  if (shouldIgnore) return () => [];
  return labelKey => reviewGroupNames.map(key => config.labels.review[key][labelKey]).filter(Boolean).map(name => labels[name].id);
};

async function initRepoContext(appContext, context, config) {
  const {
    id,
    name,
    full_name: fullName,
    owner: org,
    description
  } = context.payload.repository;
  const repoEmoji = getEmojiFromRepoDescription(description);
  const accountContext = await obtainAccountContext(appContext, context, config, org);
  const repoContext = Object.create(accountContext);
  const shouldIgnore = shouldIgnoreRepo(name, config);
  const labels = shouldIgnore ? {} : await initRepoLabels(context, config);
  const reviewGroupNames = Object.keys(config.groups);
  const getReviewLabelIds = createGetReviewLabelIds(shouldIgnore, config, reviewGroupNames, labels);
  const needsReviewLabelIds = getReviewLabelIds('needsReview');
  const requestedReviewLabelIds = getReviewLabelIds('requested');
  const changesRequestedLabelIds = getReviewLabelIds('changesRequested');
  const approvedReviewLabelIds = getReviewLabelIds('approved');
  const protectedLabelIds = [...requestedReviewLabelIds, ...changesRequestedLabelIds, ...approvedReviewLabelIds];
  const labelIdToGroupName = new Map();

  if (!shouldIgnore) {
    reviewGroupNames.forEach(key => {
      const reviewGroupLabels = config.labels.review[key];
      Object.keys(reviewGroupLabels).forEach(labelKey => {
        labelIdToGroupName.set(labels[reviewGroupLabels[labelKey]].id, key);
      });
    });
  } // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};


  const lock$1 = lock.Lock();
  let lockMergePr;
  let automergeQueue = [];

  const lockPR = (prOrPrIssueId, prNumber, callback) => new Promise((resolve, reject) => {
    const logInfos = {
      repo: fullName,
      prOrPrIssueId,
      prNumber
    };
    context.log.debug(logInfos, 'lock: try to lock pr'); // eslint-disable-next-line @typescript-eslint/no-misused-promises

    lock$1(String(prNumber), async createReleaseCallback => {
      const release = createReleaseCallback(() => {});
      context.log.info(logInfos, 'lock: lock pr acquired');

      try {
        await callback();
      } catch (err) {
        context.log.info(logInfos, 'lock: release pr (with error)');
        release();
        reject(err);
        return;
      }

      context.log.info(logInfos, 'lock: release pr');
      release();
      resolve();
    });
  });

  const reschedule = (context, pr) => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info(pr, 'reschedule');
    setTimeout(() => {
      lockPR('reschedule', -1, () => {
        return lockPR(String(pr.id), pr.number, async () => {
          const [pullRequest, reviewflowPrContext] = await Promise.all([fetchPr(context, pr.number), getReviewflowPrContext(pr.number, context, repoContext)]);
          await autoMergeIfPossible(pullRequest, context, repoContext, reviewflowPrContext);
        });
      });
    }, 10000);
  };

  return Object.assign(repoContext, {
    appContext,
    labels,
    repoFullName: fullName,
    repoEmbed: {
      id,
      name
    },
    repoEmoji,
    protectedLabelIds,
    shouldIgnore,
    hasNeedsReview: labels => labels.some(label => label.id && needsReviewLabelIds.includes(label.id)),
    hasRequestedReview: labels => labels.some(label => label.id && requestedReviewLabelIds.includes(label.id)),
    hasChangesRequestedReview: labels => labels.some(label => label.id && changesRequestedLabelIds.includes(label.id)),
    hasApprovesReview: labels => labels.some(label => label.id && approvedReviewLabelIds.includes(label.id)),
    getNeedsReviewGroupNames: labels => labels.filter(label => label.id && needsReviewLabelIds.includes(label.id)).map(label => labelIdToGroupName.get(label.id)).filter(ExcludesFalsy),
    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: pr => {
      // eslint-disable-next-line no-console
      console.log('merge lock: lock', {
        repo: fullName,
        pr
      });

      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }

      if (lockMergePr) throw new Error('Already have lock');
      lockMergePr = pr;
    },
    removePrFromAutomergeQueue: (context, prNumber, reason) => {
      if (lockMergePr && String(lockMergePr.number) === String(prNumber)) {
        lockMergePr = automergeQueue.shift();
        context.log(`merge lock: remove ${fullName}#${prNumber}: ${reason}`);

        if (lockMergePr) {
          context.log(lockMergePr, `merge lock: next ${fullName}`);
        } else {
          context.log(`merge lock: nothing next ${fullName}`);
        }

        if (lockMergePr) {
          reschedule(context, lockMergePr);
        }
      } else {
        const previousLength = automergeQueue.length;
        automergeQueue = automergeQueue.filter(value => String(value.number) !== String(prNumber));

        if (automergeQueue.length !== previousLength) {
          context.log(`merge lock: remove ${fullName}#${prNumber}: ${reason}`);
        }
      }
    },
    pushAutomergeQueue: pr => {
      context.log({
        repo: fullName,
        pr,
        lockMergePr,
        automergeQueue
      }, 'merge lock: push queue');

      if (!automergeQueue.some(p => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
    },
    reschedule,
    lockPR,
    lockPullRequest: (pullRequest, callback) => {
      return lockPR(String(pullRequest.id), pullRequest.number, callback);
    }
  });
}

const repoContextsPromise = new Map();
const repoContexts = new Map();
const obtainRepoContext = (appContext, context) => {
  const repo = context.payload.repository;
  const owner = repo.owner;
  const key = repo.id;
  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;
  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);
  let accountConfig = accountConfigs[owner.login];

  if (!accountConfig) {
    context.log(`using default config for ${owner.login}`);
    accountConfig = config$2;
  }

  const promise = initRepoContext(appContext, context, accountConfig);
  repoContextsPromise.set(key, promise);
  return promise.then(repoContext => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};

const createRepoHandler = (appContext, callback) => {
  return async context => {
    const repoContext = await obtainRepoContext(appContext, context);
    if (!repoContext) return;
    return callback(context, repoContext);
  };
};

const createPullRequestHandler = (appContext, getPullRequestInPayload, callbackPr, callbackBeforeLock) => {
  return createRepoHandler(appContext, async (context, repoContext) => {
    const pullRequest = getPullRequestInPayload(context.payload, context, repoContext);
    if (pullRequest === null) return;
    const options = callbackBeforeLock ? callbackBeforeLock(pullRequest, context, repoContext) : {};
    await repoContext.lockPullRequest(pullRequest, async () => {
      /*
       * When repo are ignored, only slack notifications are sent.
       * PR is not linted, commented, nor auto merged.
       */
      const reviewflowPrContext = repoContext.shouldIgnore ? null : await getReviewflowPrContext(pullRequest.number, context, repoContext, options.reviewflowCommentPromise);
      return callbackPr(pullRequest, context, repoContext, reviewflowPrContext);
    });
  });
};
const createPullRequestsHandler = (appContext, getPrs, callbackPr) => {
  return createRepoHandler(appContext, async (context, repoContext) => {
    const prs = getPrs(context.payload, repoContext);
    if (prs.length === 0) return;
    await Promise.all(prs.map(pr => repoContext.lockPR(String(pr.id), pr.number, async () => {
      return callbackPr(pr, context, repoContext);
    })));
  });
};

function checkrunCompleted(app, appContext) {
  app.on('check_run.completed', createPullRequestsHandler(appContext, (payload, repoContext) => {
    if (repoContext.shouldIgnore) return [];
    return payload.check_run.pull_requests;
  }, async (pullRequest, context, repoContext) => {
    const [updatedPr, reviewflowPrContext] = await Promise.all([fetchPr(context, pullRequest.number), getReviewflowPrContext(pullRequest.number, context, repoContext)]);
    await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext);
  }));
}

function checksuiteCompleted(app, appContext) {
  app.on('check_suite.completed', createPullRequestsHandler(appContext, (payload, repoContext) => {
    if (repoContext.shouldIgnore) return [];
    return payload.check_suite.pull_requests;
  }, async (pullRequest, context, repoContext) => {
    const [updatedPr, reviewflowPrContext] = await Promise.all([fetchPr(context, pullRequest.number), getReviewflowPrContext(pullRequest.number, context, repoContext)]);
    await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext);
  }));
}

const createLink = (url, text) => {
  return `<${url}|${text}>`;
};
const createPrLink = (pr, repoContext) => {
  return createLink(pr.html_url, `${repoContext.repoEmoji ? `${repoContext.repoEmoji} ` : ''}${repoContext.repoFullName}#${pr.number}`);
};
const createOwnerPart = (ownerMention, pullRequest, sendTo) => {
  const owner = pullRequest.user;
  if (owner && owner.id === sendTo.id) return 'your PR';
  const isAssignedTo = !!pullRequest.assignees && pullRequest.assignees.some(a => a && a.id === sendTo.id);
  return `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ''}`;
};

async function createStatus(context, name, sha, type, description, url) {
  if (description.length > 140) {
    context.log('description too long', {
      description
    });
    description = description.slice(0, 140);
  }

  await context.octokit.repos.createCommitStatus(context.repo({
    context: name === '' ? process.env.REVIEWFLOW_NAME : `${process.env.REVIEWFLOW_NAME}/${name}`,
    sha,
    state: type,
    description,
    target_url: url
  }));
}

const addStatusCheck = async function (pullRequest, context, {
  state,
  description
}, previousSha) {
  const hasPrCheck = (await context.octokit.checks.listForRef(context.repo({
    ref: pullRequest.head.sha
  }))).data.check_runs.find(check => check.name === process.env.REVIEWFLOW_NAME);
  context.log.debug({
    hasPrCheck,
    state,
    description
  }, 'add status check');

  if (hasPrCheck) {
    await context.octokit.checks.create(context.repo({
      name: process.env.REVIEWFLOW_NAME,
      head_sha: pullRequest.head.sha,
      started_at: pullRequest.created_at,
      status: 'completed',
      conclusion: state,
      completed_at: new Date().toISOString(),
      output: {
        title: description,
        summary: ''
      }
    }));
  } else if (previousSha && state === 'failure') {
    await Promise.all([createStatus(context, '', previousSha, 'success', 'New commits have been pushed'), createStatus(context, '', pullRequest.head.sha, state, description)]);
  } else {
    await createStatus(context, '', pullRequest.head.sha, state, description);
  }
};

const updateStatusCheckFromLabels = (pullRequest, context, repoContext, labels = pullRequest.labels || [], previousSha) => {
  context.log.debug({
    labels: labels.map(l => l === null || l === void 0 ? void 0 : l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels)
  }, 'updateStatusCheckFromLabels');

  const createFailedStatusCheck = description => addStatusCheck(pullRequest, context, {
    state: 'failure',
    description
  }, previousSha);

  if (pullRequest.requested_reviewers && pullRequest.requested_reviewers.length > 0) {
    return createFailedStatusCheck(`Awaiting review from: ${pullRequest.requested_reviewers.filter(ExcludesFalsy).map(rr => rr.login).join(', ')}`);
  }

  if (pullRequest.requested_teams && pullRequest.requested_teams.length > 0) {
    return createFailedStatusCheck(`Awaiting review from: ${pullRequest.requested_teams.filter(ExcludesFalsy).map(rt => rt.name).join(', ')}`);
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck('Changes requested ! Push commits or discuss changes then re-request a review.');
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length > 0) {
    return createFailedStatusCheck(`Awaiting review from: ${needsReviewGroupNames.join(', ')}. Perhaps request someone ?`);
  }

  if (!repoContext.hasApprovesReview(labels)) {
    if (repoContext.config.requiresReviewRequest) {
      return createFailedStatusCheck('Awaiting review... Perhaps request someone ?');
    }
  } // if (
  //   repoContext.config.requiresReviewRequest &&
  //   !repoContext.hasRequestedReview(labels)
  // ) {
  //   return  createFailedStatusCheck(
  //     context,
  //     pr,
  //     'You need to request someone to review the PR',
  //   );
  //   return;
  // }
  // return  createInProgressStatusCheck(context);
  // } else if (repoContext.hasApprovesReview(labels)) {


  return addStatusCheck(pullRequest, context, {
    state: 'success',
    description: '✓ PR ready to merge !'
  }, previousSha); // }
};

const updateReviewStatus = async (pullRequest, context, repoContext, reviewGroup, {
  add: labelsToAdd,
  remove: labelsToRemove
}) => {
  context.log.debug({
    reviewGroup,
    labelsToAdd,
    labelsToRemove
  }, 'updateReviewStatus');
  let prLabels = pullRequest.labels || [];
  if (!reviewGroup) return prLabels;
  const newLabelNames = new Set(prLabels.map(label => label.name).filter(ExcludesFalsy));
  const toAdd = new Set();
  const toAddNames = new Set();
  const toDelete = new Set();
  const toDeleteNames = new Set();
  const labels = repoContext.labels;

  const getLabelFromKey = key => {
    const reviewConfig = repoContext.config.labels.review[reviewGroup];
    if (!reviewConfig) return undefined;
    return reviewConfig[key] && labels[reviewConfig[key]] ? labels[reviewConfig[key]] : undefined;
  };

  if (labelsToAdd) {
    labelsToAdd.forEach(key => {
      if (!key) return;
      const label = getLabelFromKey(key);

      if (!label || !label.name || prLabels.some(prLabel => prLabel.id === label.id)) {
        return;
      }

      newLabelNames.add(label.name);
      toAdd.add(key);
      toAddNames.add(label.name);
    });
  }

  if (labelsToRemove) {
    labelsToRemove.forEach(key => {
      if (!key) return;
      const label = getLabelFromKey(key);
      if (!label) return;
      const existing = prLabels.find(prLabel => prLabel.id === label.id);

      if (existing && existing.name) {
        newLabelNames.delete(existing.name);
        toDelete.add(key);
        toDeleteNames.add(existing.name);
      }
    });
  } // TODO move that elsewhere


  if (pullRequest.user) {
    repoContext.getTeamsForLogin(pullRequest.user.login).forEach(teamName => {
      const team = repoContext.config.teams[teamName];

      if (team.labels) {
        team.labels.forEach(labelKey => {
          const label = repoContext.labels[labelKey];

          if (label && !prLabels.some(prLabel => prLabel.id === label.id)) {
            newLabelNames.add(label.name);
            toAdd.add(labelKey);
            toAddNames.add(label.name);
          }
        });
      }
    });
  } // if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return;


  if (toAdd.size > 0 || toDelete.size > 0) {
    if (toDelete.size === 0 || toDelete.size < 4) {
      context.log.debug({
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        toAddNames: [...toAddNames],
        toDeleteNames: [...toDeleteNames]
      }, 'updateReviewStatus');

      if (toAdd.size > 0) {
        const result = await context.octokit.issues.addLabels(context.issue({
          labels: [...toAddNames]
        }));
        prLabels = result.data;
      }

      if (toDelete.size > 0) {
        for (const toDeleteName of toDeleteNames) {
          try {
            const result = await context.octokit.issues.removeLabel(context.issue({
              name: toDeleteName
            }));
            prLabels = result.data;
          } catch (err) {
            context.log.warn({
              err: err === null || err === void 0 ? void 0 : err.message
            }, 'error removing label');
          }
        }
      }
    } else {
      const newLabelNamesArray = [...newLabelNames];
      context.log.debug({
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        oldLabels: prLabels.map(l => l.name),
        newLabelNames: newLabelNamesArray
      }, 'updateReviewStatus');
      const result = await context.octokit.issues.setLabels(context.issue({
        labels: newLabelNamesArray
      }));
      prLabels = result.data;
    }
  } // if (toAdd.has('needsReview')) {
  //   createInProgressStatusCheck(context);
  // } else if (
  //   toDelete.has('needsReview') ||
  //   (prLabels.length === 0 && toAdd.size === 1 && toAdd.has('approved'))
  // ) {


  await updateStatusCheckFromLabels(pullRequest, context, repoContext, prLabels); // }

  return prLabels;
};

const getReviewersAndReviewStates = async (context, repoContext) => {
  const userIds = new Set();
  const reviewers = [];
  const reviewStatesByUser = new Map();
  await context.octokit.paginate(context.octokit.pulls.listReviews, context.pullRequest({
    page: undefined
  }), ({
    data: reviews
  }) => {
    reviews.forEach(review => {
      if (!review.user) return;

      if (!userIds.has(review.user.id)) {
        userIds.add(review.user.id);
        reviewers.push({
          id: review.user.id,
          login: review.user.login,
          type: review.user.type
        });
      }

      const state = review.state.toUpperCase();

      if (state !== 'COMMENTED') {
        reviewStatesByUser.set(review.user.id, state);
      }
    });
    return [];
  });
  const reviewStates = {};
  getKeys(repoContext.config.groups).forEach(groupName => {
    reviewStates[groupName] = {
      approved: 0,
      changesRequested: 0,
      dismissed: 0
    };
  });
  reviewers.forEach(reviewer => {
    const group = repoContext.getReviewerGroup(reviewer.login);

    if (group) {
      const state = reviewStatesByUser.get(reviewer.id);

      switch (state) {
        case 'APPROVED':
          reviewStates[group].approved++;
          break;

        case 'CHANGES_REQUESTED':
          reviewStates[group].changesRequested++;
          break;

        case 'DISMISSED':
          reviewStates[group].dismissed++;
          break;
      }
    }
  });
  return {
    reviewers,
    reviewStates
  };
};

function getRolesFromPullRequestAndReviewers(pullRequest, reviewers) {
  const owner = pullRequest.user;
  const assignees = pullRequest.assignees;
  const assigneeIds = assignees.map(a => a.id);
  const followers = reviewers.filter(user => !assigneeIds.includes(user.id));
  const requestedReviewers = pullRequest.requested_reviewers.map(rr => ({ ...rr,
    isRequestedByName: true,
    requestedByTeams: []
  }));

  if (pullRequest.requested_teams) ;

  if (requestedReviewers) {
    followers.push(...requestedReviewers.filter(rr => {
      return !followers.some(f => f.id === rr.id) && !assigneeIds.includes(rr.id);
    }));
  }

  return {
    owner,
    assignees,
    reviewers,
    requestedReviewers,
    followers
  };
}

function closed(app, appContext) {
  app.on('pull_request.closed', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    /* if repo is not ignored */
    if (reviewflowPrContext) {
      /* update status, update automerge queue, delete branch */
      const repo = context.payload.repository;

      if (pullRequest.merged) {
        const isNotFork = pullRequest.head.repo.id === repo.id;
        const options = parseOptions(reviewflowPrContext.commentBody, repoContext.config.prDefaultOptions);
        await Promise.all([repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'pr closed'), isNotFork && options.deleteAfterMerge ? context.octokit.git.deleteRef(context.repo({
          ref: `heads/${pullRequest.head.ref}`
        })).catch(() => {}) : undefined]);
      } else {
        await Promise.all([repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'pr closed'), updateReviewStatus(pullRequest, context, repoContext, 'dev', {
          remove: ['needsReview']
        })]);
      }
    }
    /* update slack home */


    if (pullRequest.requested_reviewers) {
      pullRequest.requested_reviewers.forEach(requestedReviewer => {
        repoContext.slack.updateHome(requestedReviewer.login);
      });
    }

    if (pullRequest.requested_teams) {
      await Promise.all(pullRequest.requested_teams.map(async team => {
        const members = await repoContext.getMembersForTeam(team.id);
        members.forEach(member => {
          repoContext.slack.updateHome(member.login);
        });
      }));
    }

    if (pullRequest.assignees) {
      pullRequest.assignees.forEach(assignee => {
        repoContext.slack.updateHome(assignee.login);
      });
    }
    /* send notifications to assignees and followers */


    const {
      reviewers
    } = await getReviewersAndReviewStates(context, repoContext);
    const {
      owner,
      assignees,
      followers
    } = getRolesFromPullRequestAndReviewers(pullRequest, reviewers);
    const senderMention = repoContext.slack.mention(context.payload.sender.login);
    const ownerMention = repoContext.slack.mention(owner.login);
    const prLink = createPrLink(pullRequest, repoContext);

    const createMessage = to => {
      const ownerPart = createOwnerPart(ownerMention, pullRequest, to);
      return `${pullRequest.merged ? `:rocket: ${senderMention} merged` : `:wastebasket: ${senderMention} closed`} ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
    };

    assignees.map(assignee => {
      if (context.payload.sender.id === assignee.id) return;
      return repoContext.slack.postMessage('pr-lifecycle', assignee, {
        text: createMessage(assignee)
      });
    });
    followers.map(follower => {
      if (context.payload.sender.id === follower.id) return;
      return repoContext.slack.postMessage('pr-lifecycle-follow', follower, {
        text: createMessage(follower)
      });
    });
  }));
}

const createMrkdwnSectionBlock = text => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text
  }
});
const createSlackMessageWithSecondaryBlock = (message, secondaryBlockText) => {
  return {
    text: message,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message
      }
    }],
    secondaryBlocks: !secondaryBlockText ? undefined : [createMrkdwnSectionBlock(secondaryBlockText)]
  };
};

/** deprecated */
const getPullRequestFromPayload = payload => {
  const pullRequest = payload.pull_request;

  if (pullRequest) {
    return pullRequest;
  }

  const issue = payload.issue;

  if (issue !== null && issue !== void 0 && issue.pull_request) {
    return { ...issue,
      ...issue.pull_request
    };
  }

  throw new Error('No pull_request in payload');
};

const parse = issueParser__default('github', {
  actions: {},
  issuePrefixes: []
});
const parseMentions = body => {
  return parse(body).mentions.map(m => m.user);
};

const slackifyCommentBody = (body, multipleLines) => {
  return slackifyMarkdown__default(body.replace('```suggestion', '_Suggested change:_\n```suggestion').replace('```suggestion\r\n```', `_Suggestion to remove line${multipleLines ? 's' : ''}._\n`));
};

const getDiscussion = async (context, comment) => {
  if (!comment.in_reply_to_id) return [comment];
  return context.octokit.paginate(context.octokit.pulls.listReviewComments, context.pullRequest(), ({
    data
  }) => {
    return data.filter(c => c.in_reply_to_id === comment.in_reply_to_id || c.id === comment.in_reply_to_id);
  });
};

const getMentions = discussion => {
  const mentions = new Set();
  discussion.forEach(c => {
    parseMentions(c.body).forEach(m => mentions.add(m));
  });
  return [...mentions];
};

const getUsersInThread = discussion => {
  const userIds = new Set();
  const users = [];
  discussion.forEach(c => {
    if (!c.user || userIds.has(c.user.id)) return;
    userIds.add(c.user.id);
    users.push({
      id: c.user.id,
      login: c.user.login,
      type: c.user.type
    });
  });
  return users;
};

function prCommentCreated(app, appContext) {
  const saveInDb = async (type, commentId, accountEmbed, results, message) => {
    const filtered = results.filter(ExcludesNullish);
    if (filtered.length === 0) return;
    await appContext.mongoStores.slackSentMessages.insertOne({
      type,
      typeId: commentId,
      message,
      account: accountEmbed,
      sentTo: filtered
    });
  };

  app.on(['pull_request_review_comment.created', // comments without review and without path are sent with issue_comment.created.
  // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
  'issue_comment.created'], createPullRequestHandler(appContext, payload => {
    if (checkIfIsThisBot(payload.comment.user)) {
      // ignore comments from this bot
      return null;
    }

    return getPullRequestFromPayload(payload);
  }, async (pullRequest, context, repoContext) => {
    const pr = await fetchPr(context, pullRequest.number);
    const prUser = pr.user;
    if (!prUser) return;
    const {
      comment
    } = context.payload;
    const type = comment.pull_request_review_id ? 'review-comment' : 'issue-comment';
    const body = comment.body;
    if (!body) return;
    const commentByOwner = prUser.login === comment.user.login;
    const [discussion, {
      reviewers
    }] = await Promise.all([getDiscussion(context, comment), getReviewersAndReviewStates(context, repoContext)]);
    const followers = reviewers.filter(u => u.id !== prUser.id && u.id !== comment.user.id);

    if (pr.requested_reviewers) {
      followers.push(...pr.requested_reviewers.filter(rr => {
        return rr && !followers.some(f => f.id === rr.id) && rr.id !== (comment.user && comment.user.id) && rr.id !== prUser.id;
      }).filter(ExcludesFalsy).map(rr => ({
        id: rr.id,
        login: rr.login,
        type: rr.type
      })));
    }

    const usersInThread = getUsersInThread(discussion).filter(u => u.id !== prUser.id && u.id !== comment.user.id && !followers.some(f => f.id === u.id));
    const mentions = getMentions(discussion).filter(m => m !== prUser.login && m !== comment.user.login && !followers.some(f => f.login === m) && !usersInThread.some(u => u.login === m));
    const mention = repoContext.slack.mention(comment.user.login);
    const prUrl = createPrLink(pr, repoContext);
    const ownerMention = repoContext.slack.mention(prUser.login);
    const commentLink = createLink(comment.html_url, comment.in_reply_to_id ? 'replied' : 'commented');

    const createMessage = toOwner => {
      const ownerPart = toOwner ? 'your PR' : `${(prUser && prUser.id) === comment.user.id ? 'his' : `${ownerMention}'s`} PR`;
      return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
    };

    const promisesOwner = [];
    const promisesNotOwner = [];
    const slackifiedBody = slackifyCommentBody(comment.body, comment.start_line !== null);
    const isBotUser = checkIfUserIsBot(repoContext, comment.user);

    if (!commentByOwner) {
      const slackMessage = createSlackMessageWithSecondaryBlock(createMessage(true), slackifiedBody);
      promisesOwner.push(repoContext.slack.postMessage(isBotUser ? 'pr-comment-bots' : 'pr-comment', prUser, slackMessage).then(res => saveInDb(type, comment.id, repoContext.accountEmbed, [res], slackMessage)));
    }

    const message = createSlackMessageWithSecondaryBlock(createMessage(false), slackifiedBody);
    promisesNotOwner.push(...followers.map(follower => repoContext.slack.postMessage(isBotUser ? 'pr-comment-follow-bots' : 'pr-comment-follow', follower, message)), ...usersInThread.map(user => repoContext.slack.postMessage('pr-comment-thread', user, message)));

    if (mentions.length > 0) {
      await appContext.mongoStores.users.findAll({
        login: {
          $in: mentions
        }
      }).then(users => {
        promisesNotOwner.push(...users.map(u => repoContext.slack.postMessage('pr-comment-mention', {
          id: u._id,
          login: u.login,
          type: u.type
        }, message)));
      });
    }

    await Promise.all([Promise.all(promisesOwner), Promise.all(promisesNotOwner).then(results => saveInDb(type, comment.id, repoContext.accountEmbed, results, message))]);
  }));
}

const updatePrCommentBody = async (context, reviewflowPrContext, newBody) => {
  await context.octokit.issues.updateComment(context.repo({
    comment_id: reviewflowPrContext.reviewflowPr.commentId,
    body: newBody
  }));
  reviewflowPrContext.commentBody = newBody;
};

const updatePrCommentBodyIfNeeded = async (context, reviewflowPrContext, newBody) => {
  if (reviewflowPrContext.commentBody !== newBody) {
    await updatePrCommentBody(context, reviewflowPrContext, newBody);
  }
};
const updatePrCommentBodyOptions = async (context, repoContext, reviewflowPrContext, updateOptions) => {
  const {
    commentBody: newBody
  } = updateCommentOptions(context.payload.repository.html_url, repoContext.config.labels.list, reviewflowPrContext.commentBody, repoContext.config.prDefaultOptions, updateOptions);
  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody);
};

async function syncLabel(pullRequest, context, shouldHaveLabel, label, prHasLabel = hasLabelInPR(pullRequest.labels, label), {
  onRemove,
  onAdd
} = {}) {
  if (prHasLabel && !shouldHaveLabel) {
    await context.octokit.issues.removeLabel(context.issue({
      name: label.name
    }));
    if (onRemove) await onRemove();
  }

  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.octokit.issues.addLabels(context.issue({
      labels: [label.name]
    }));
    if (onAdd) await onAdd(response.data);
  }
}

const calcDefaultOptions = (repoContext, pullRequest) => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);
  return { ...repoContext.config.prDefaultOptions,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel
  };
};
const syncLabelsAfterCommentBodyEdited = async (pullRequest, context, repoContext, reviewflowPrContext) => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);
  const {
    commentBody,
    options
  } = updateCommentOptions(context.payload.repository.html_url, repoContext.config.labels.list, reviewflowPrContext.commentBody, calcDefaultOptions(repoContext, pullRequest));
  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options && automergeLabel) {
    await Promise.all([skipCiLabel && syncLabel(pullRequest, context, options.autoMergeWithSkipCi, skipCiLabel, prHasSkipCiLabel), automergeLabel && syncLabel(pullRequest, context, options.autoMerge, automergeLabel, prHasAutoMergeLabel, {
      onAdd: async prLabels => {
        await autoMergeIfPossible(pullRequest, context, repoContext, reviewflowPrContext, prLabels);
      },
      onRemove: () => {
        repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'label removed');
      }
    })]);
  }
};

function prCommentEditedOrDeleted(app, appContext) {
  app.on(['pull_request_review_comment.edited', 'pull_request_review_comment.deleted', // comments without review and without path are sent with issue_comment.created.
  // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
  'issue_comment.edited', 'issue_comment.deleted'], createPullRequestHandler(appContext, payload => {
    if (checkIfIsThisBot(payload.sender)) {
      // ignore edits made from this bot
      return null;
    }

    return getPullRequestFromPayload(payload);
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    const {
      comment
    } = context.payload;

    if (reviewflowPrContext !== null && context.payload.action === 'edited' && checkIfIsThisBot(comment.user)) {
      const updatedPr = await fetchPr(context, pullRequest.number);

      if (!updatedPr.closed_at) {
        await syncLabelsAfterCommentBodyEdited(updatedPr, context, repoContext, reviewflowPrContext);
      }

      return;
    }

    const type = comment.pull_request_review_id ? 'review-comment' : 'issue-comment';
    const criteria = {
      'account.id': repoContext.accountEmbed.id,
      'account.type': repoContext.accountEmbed.type,
      type,
      typeId: comment.id
    };
    const sentMessages = await appContext.mongoStores.slackSentMessages.findAll(criteria);
    if (sentMessages.length === 0) return;

    if (context.payload.action === 'deleted') {
      await Promise.all([Promise.all(sentMessages.map(sentMessage => Promise.all(sentMessage.sentTo.map(sentTo => repoContext.slack.deleteMessage(sentMessage.account, sentTo.ts, sentTo.channel))))), appContext.mongoStores.slackSentMessages.deleteMany(criteria)]);
    } else {
      const secondaryBlocks = [createMrkdwnSectionBlock(slackifyCommentBody(comment.body, comment.start_line !== null))];
      await Promise.all([Promise.all(sentMessages.map(sentMessage => Promise.all(sentMessage.sentTo.map(sentTo => repoContext.slack.updateMessage(sentMessage.account, sentTo.ts, sentTo.channel, { ...sentMessage.message,
        secondaryBlocks
      }))))), appContext.mongoStores.slackSentMessages.partialUpdateMany(criteria, {
        $set: {
          'message.secondaryBlocks': secondaryBlocks
        }
      })]);
    }
  }));
}

const readCommitsAndUpdateInfos = async (pullRequest, context, repoContext, reviewflowPrContext, commentBody = reviewflowPrContext.commentBody) => {
  // tmp.data[0].sha
  // tmp.data[0].commit.message
  const commits = await readPullRequestCommits(context);
  const conventionalCommits = await Promise.all(commits.map(c => parse__default(c.commit.message)));
  const breakingChangesCommits = [];
  conventionalCommits.forEach((c, index) => {
    const breakingChangesNotes = c.notes.filter(note => note.title === 'BREAKING CHANGE');

    if (breakingChangesNotes.length > 0) {
      breakingChangesCommits.push({
        commit: commits[index],
        breakingChangesNotes
      });
    }
  });
  const breakingChangesLabel = repoContext.labels['breaking-changes'];
  const newCommentBody = updateCommentBodyCommitsNotes(commentBody, breakingChangesCommits.length === 0 ? '' : `Breaking Changes:\n${breakingChangesCommits.map(({
    commit,
    breakingChangesNotes
  }) => breakingChangesNotes.map(note => `- ${note.text.replace('\n', ' ')} (${commit.sha})`)).join('')}`);
  await Promise.all([syncLabel(pullRequest, context, breakingChangesCommits.length > 0, breakingChangesLabel), updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newCommentBody)]); // TODO auto update ! in front of : to signal a breaking change when https://github.com/conventional-changelog/commitlint/issues/658 is closed
};

const cleanNewLines = text => !text ? '' : text.replace(/\r\n/g, '\n');

const checkIfHasDiff = (text1, text2) => cleanNewLines(text1) !== cleanNewLines(text2);

const updatePrIfNeeded = async (pullRequest, context, update) => {
  const hasDiffInTitle = update.title && pullRequest.title !== update.title;
  const hasDiffInBody = update.body && checkIfHasDiff(pullRequest.body, update.body);

  if (hasDiffInTitle || hasDiffInBody) {
    const diff = {};

    if (hasDiffInTitle) {
      diff.title = update.title;
      pullRequest.title = update.title;
    }

    if (hasDiffInBody) {
      diff.body = update.body;
      pullRequest.body = update.body;
    }

    await context.octokit.pulls.update(context.repo({
      pull_number: pullRequest.number,
      ...diff
    }));
  }
};

const cleanTitle = title => title.trim().replace(/[\s-]+\[?\s*([A-Za-z][\dA-Za-z]+)[ -](\d+)\s*]?\s*$/, (s, arg1, arg2) => ` ${arg1.toUpperCase()}-${arg2}`).replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `).replace(/^Revert "([^"]+)"$/, 'revert: $1').replace(/\s+[[\]]\s*no\s*issue\s*[[\]]$/i, ' [no issue]').replace(/^(revert:.*)(\s+\(#\d+\))$/, '$1');

const editOpenedPR = async (pullRequest, context, repoContext, reviewflowPrContext, shouldUpdateCommentBodyInfos, previousSha) => {
  var _pullRequest$user;

  const title = repoContext.config.trimTitle ? cleanTitle(pullRequest.title) : pullRequest.title;
  const parsePRValue = {
    title,
    head: pullRequest.head.ref,
    base: pullRequest.base.ref
  };
  const isPrFromBot = !pullRequest.user ? false : checkIfUserIsBot(repoContext, pullRequest.user);
  const statuses = [];
  let errorStatus;
  getKeys(repoContext.config.parsePR).forEach(parsePRKey => {
    const rules = repoContext.config.parsePR[parsePRKey];
    if (!rules) return;
    const value = parsePRValue[parsePRKey];
    rules.forEach(rule => {
      if (rule.bot === false && isPrFromBot) return;
      const match = rule.regExp.exec(value);
      const status = rule.createStatusInfo(match, parsePRValue, isPrFromBot);

      if (status !== null) {
        if (rule.status) {
          statuses.push({
            name: rule.status,
            status
          });
        } else if (status.type === 'failure') {
          if (!errorStatus) {
            errorStatus = status;
          }
        }
      }
    });
  });
  const date = new Date().toISOString();
  const hasLintPrCheck = (await context.octokit.checks.listForRef(context.repo({
    ref: pullRequest.head.sha
  }))).data.check_runs.find(check => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`);
  const promises = [...statuses.map(({
    name,
    status
  }) => createStatus(context, name, pullRequest.head.sha, status.type, status.title, status.url)), ...(previousSha ? statuses.filter(({
    status
  }) => status.type === 'failure').map(({
    name
  }) => createStatus(context, name, previousSha, 'success', 'New commits have been pushed')) : []), hasLintPrCheck && context.octokit.checks.create(context.repo({
    name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
    head_sha: pullRequest.head.sha,
    status: 'completed',
    conclusion: errorStatus ? 'failure' : 'success',
    started_at: date,
    completed_at: date,
    output: errorStatus ? {
      title: errorStatus.title,
      summary: errorStatus.summary
    } : {
      title: '✓ PR is valid',
      summary: ''
    }
  })), !hasLintPrCheck && previousSha && errorStatus ? createStatus(context, 'lint-pr', previousSha, 'success', 'New commits have been pushed') : undefined, !hasLintPrCheck && createStatus(context, 'lint-pr', pullRequest.head.sha, errorStatus ? 'failure' : 'success', errorStatus ? errorStatus.title : '✓ PR is valid', errorStatus ? errorStatus.url : undefined)].filter(ExcludesFalsy);
  const body = removeDeprecatedReviewflowInPrBody(pullRequest.body);
  promises.push(updatePrIfNeeded(pullRequest, context, {
    title,
    body
  }));
  const commentBodyInfos = statuses.filter(status => status.status.inBody).map(status => status.status);

  if ( // not a bot
  !isPrFromBot && // should not happen, but ts needs it
  (_pullRequest$user = pullRequest.user) !== null && _pullRequest$user !== void 0 && _pullRequest$user.login && // belongs to the organization
  repoContext.getReviewerGroup(pullRequest.user.login) && // has not connected its slack account yet
  repoContext.slack.shouldShowLoginMessage(pullRequest.user.login)) {
    commentBodyInfos.push({
      type: 'failure',
      title: `@${pullRequest.user.login} Connect your account to Slack to get notifications for your PRs !`,
      url: `${process.env.REVIEWFLOW_APP_URL}/org/${context.payload.repository.owner.login}`,
      summary: ''
    });
  }

  const shouldCreateCommentBody = reviewflowPrContext.commentBody === defaultCommentBody;
  const newBody = shouldCreateCommentBody ? createCommentBody(context.payload.repository.html_url, repoContext.config.labels.list, calcDefaultOptions(repoContext, pullRequest), commentBodyInfos) : updateCommentBodyInfos(reviewflowPrContext.commentBody, commentBodyInfos);

  if (shouldCreateCommentBody || shouldUpdateCommentBodyInfos) {
    promises.push(readCommitsAndUpdateInfos(pullRequest, context, repoContext, reviewflowPrContext, newBody));
  } else {
    promises.push(updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody));
  }

  await Promise.all(promises);
};

function edited(app, appContext) {
  app.on('pull_request.edited', createPullRequestHandler(appContext, (payload, context, repoContext) => {
    if (repoContext.shouldIgnore) return null;
    return payload.pull_request;
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    if (reviewflowPrContext == null) return;
    const sender = context.payload.sender;

    if (checkIfIsThisBot(sender)) {
      return;
    }

    const updatedPullRequest = await fetchPr(context, context.payload.pull_request.number);
    await editOpenedPR(updatedPullRequest, context, repoContext, reviewflowPrContext, false);
    await autoMergeIfPossible(updatedPullRequest, context, repoContext, reviewflowPrContext);
  }));
}

const isFromRenovate = payload => {
  const sender = payload.sender;
  return sender.type === 'Bot' && sender.login === 'renovate[bot]' && payload.pull_request.head.ref.startsWith('renovate/');
};

function labelsChanged(app, appContext) {
  app.on(['pull_request.labeled', 'pull_request.unlabeled'], createPullRequestHandler(appContext, (payload, context, repoContext) => {
    if (payload.sender.type === 'Bot' && !isFromRenovate(payload)) {
      return null;
    }

    if (repoContext.shouldIgnore) return null;
    return payload.pull_request;
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    if (reviewflowPrContext === null) return;
    const fromRenovate = isFromRenovate(context.payload);
    const updatedPr = await fetchPr(context, pullRequest.number);
    const label = context.payload.label;

    if (fromRenovate) {
      const codeApprovedLabel = repoContext.labels['code/approved'];
      const codeNeedsReviewLabel = repoContext.labels['code/needs-review'];
      const autoMergeLabel = repoContext.labels['merge/automerge'];
      const autoMergeSkipCiLabel = repoContext.labels['merge/skip-ci'];

      if (context.payload.action === 'labeled') {
        if (codeApprovedLabel && label.id === codeApprovedLabel.id) {
          // const { data: reviews } = await context.octokit.pulls.listReviews(
          //   context.pullRequest({ per_page: 1 }),
          // );
          // if (reviews.length !== 0) {
          await context.octokit.pulls.createReview(context.pullRequest({
            event: 'APPROVE'
          }));
          let labels = updatedPr.labels;
          const autoMergeWithSkipCi = autoMergeSkipCiLabel && repoContext.config.autoMergeRenovateWithSkipCi;

          if (autoMergeWithSkipCi) {
            const result = await context.octokit.issues.addLabels(context.issue({
              labels: [autoMergeSkipCiLabel.name]
            }));
            labels = result.data;
          }

          if (hasLabelInPR(labels, codeNeedsReviewLabel)) {
            await updateReviewStatus(updatedPr, context, repoContext, 'dev', {
              remove: ['needsReview']
            });
          } else {
            await updateStatusCheckFromLabels(updatedPr, context, repoContext, labels);
          }

          await updatePrCommentBodyOptions(context, repoContext, reviewflowPrContext, {
            autoMergeWithSkipCi,
            // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
            autoMerge: hasLabelInPR(labels, autoMergeLabel) ? true : repoContext.config.prDefaultOptions.autoMerge
          }); // }
        } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
          await updatePrCommentBodyOptions(context, repoContext, reviewflowPrContext, {
            autoMerge: true,
            // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
            // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
            autoMergeWithSkipCi: hasLabelInPR(pullRequest.labels, autoMergeSkipCiLabel) ? true : repoContext.config.prDefaultOptions.autoMergeWithSkipCi
          });
        }

        await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext);
      }

      return;
    }

    if (repoContext.protectedLabelIds.includes(label.id)) {
      if (context.payload.action === 'labeled') {
        await context.octokit.issues.removeLabel(context.issue({
          name: label.name
        }));
      } else {
        await context.octokit.issues.addLabels(context.issue({
          labels: [label.name]
        }));
      }

      return;
    }

    await updateStatusCheckFromLabels(updatedPr, context, repoContext);
    const updateBranchLabel = repoContext.labels['merge/update-branch'];
    const automergeLabel = repoContext.labels['merge/automerge'];
    const skipCiLabel = repoContext.labels['merge/skip-ci'];

    const option = (() => {
      if (automergeLabel && label.id === automergeLabel.id) {
        return 'autoMerge';
      }

      if (skipCiLabel && label.id === skipCiLabel.id) {
        return 'autoMergeWithSkipCi';
      }

      return null;
    })();

    if (option) {
      await updatePrCommentBodyOptions(context, repoContext, reviewflowPrContext, {
        [option]: context.payload.action === 'labeled'
      });
    } // not an else if


    if (automergeLabel && label.id === automergeLabel.id) {
      if (context.payload.action === 'labeled') {
        await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext);
      } else {
        repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'automerge label removed');
      }
    }

    if (updateBranchLabel && label.id === updateBranchLabel.id) {
      if (context.payload.action === 'labeled') {
        await updateBranch(updatedPr, context, context.payload.sender.login);
        await context.octokit.issues.removeLabel(context.issue({
          name: label.name
        }));
      }
    }
  }));
}

const autoApproveAndAutoMerge = async (pullRequest, context, repoContext, reviewflowPrContext) => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];

  if (hasLabelInPR(pullRequest.labels, codeApprovedLabel)) {
    await context.octokit.pulls.createReview(context.pullRequest({
      event: 'APPROVE'
    }));
    await autoMergeIfPossible(pullRequest, context, repoContext, reviewflowPrContext);
    return true;
  }

  return false;
};

const autoAssignPRToCreator = async (pullRequest, context, repoContext) => {
  if (!repoContext.config.autoAssignToCreator) return;
  if (!pullRequest.assignees || pullRequest.assignees.length > 0) return;
  if (!pullRequest.user || pullRequest.user.type === 'Bot') return;
  await context.octokit.issues.addAssignees(context.issue({
    assignees: [pullRequest.user.login]
  }));
};

function opened(app, appContext) {
  app.on('pull_request.opened', createPullRequestHandler(appContext, (payload, context, repoContext) => {
    if (repoContext.shouldIgnore) return null;
    return payload.pull_request;
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    if (reviewflowPrContext === null) return;
    const fromRenovate = pullRequest.head.ref.startsWith('renovate/');
    await Promise.all([autoAssignPRToCreator(pullRequest, context, repoContext), editOpenedPR(pullRequest, context, repoContext, reviewflowPrContext, true), fromRenovate ? fetchPr(context, pullRequest.number).then(updatedPr => autoApproveAndAutoMerge(updatedPr, context, repoContext, reviewflowPrContext).then(async approved => {
      if (!approved) {
        await updateReviewStatus(pullRequest, context, repoContext, 'dev', {
          add: ['needsReview']
        });
      }
    })) : updateReviewStatus(pullRequest, context, repoContext, 'dev', {
      add: repoContext.config.requiresReviewRequest ? ['needsReview'] : [],
      remove: ['approved', 'changesRequested']
    })]);
  }));
}

function reopened(app, appContext) {
  app.on('pull_request.reopened', createPullRequestHandler(appContext, payload => {
    return payload.pull_request;
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    /* if repo is not ignored */
    if (reviewflowPrContext) {
      await Promise.all([updateReviewStatus(pullRequest, context, repoContext, 'dev', {
        add: ['needsReview'],
        remove: ['approved']
      }), editOpenedPR(pullRequest, context, repoContext, reviewflowPrContext, true)]);
    }
    /* update slack home */


    if (pullRequest.requested_reviewers) {
      pullRequest.requested_reviewers.forEach(requestedReviewer => {
        repoContext.slack.updateHome(requestedReviewer.login);
      });
    }

    if (pullRequest.requested_teams) {
      await Promise.all(pullRequest.requested_teams.map(async team => {
        const members = await repoContext.getMembersForTeam(team.id);
        members.forEach(member => {
          repoContext.slack.updateHome(member.login);
        });
      }));
    }

    if (pullRequest.assignees) {
      pullRequest.assignees.forEach(assignee => {
        repoContext.slack.updateHome(assignee.login);
      });
    }
    /* send notifications to assignees and followers */


    const {
      reviewers
    } = await getReviewersAndReviewStates(context, repoContext);
    const {
      owner,
      assignees,
      followers
    } = getRolesFromPullRequestAndReviewers(pullRequest, reviewers);
    const senderMention = repoContext.slack.mention(context.payload.sender.login);
    const ownerMention = repoContext.slack.mention(owner.login);
    const prLink = createPrLink(pullRequest, repoContext);

    const createMessage = to => {
      const ownerPart = createOwnerPart(ownerMention, pullRequest, to);
      return `:recycle: ${senderMention} reopened ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
    };

    assignees.map(assignee => {
      if (context.payload.sender.id === assignee.id) return;
      return repoContext.slack.postMessage('pr-lifecycle', assignee, {
        text: createMessage(assignee)
      });
    });
    followers.map(follower => {
      if (context.payload.sender.id === follower.id) return;
      return repoContext.slack.postMessage('pr-lifecycle-follow', follower, {
        text: createMessage(follower)
      });
    });
  }));
}

function reviewDismissed(app, appContext) {
  app.on('pull_request_review.dismissed', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext) => {
    const sender = context.payload.sender;
    const reviewer = context.payload.review.user;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (!repoContext.shouldIgnore && reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const updatedPr = await fetchPr(context, pullRequest.number);
      const {
        reviewStates
      } = await getReviewersAndReviewStates(context, repoContext);
      const hasChangesRequestedInReviews = reviewStates[reviewerGroup].changesRequested !== 0;
      const hasApprovals = reviewStates[reviewerGroup].approved !== 0;
      const hasRequestedReviewsForGroup = repoContext.approveShouldWait(reviewerGroup, updatedPr, {
        includesReviewerGroup: true
      });
      await updateReviewStatus(updatedPr, context, repoContext, reviewerGroup, {
        add: [!hasApprovals && 'needsReview', hasApprovals && !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && 'approved'],
        remove: [!hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && 'requested', !hasChangesRequestedInReviews && 'changesRequested', !hasApprovals && 'approved']
      });

      if (updatedPr.assignees) {
        updatedPr.assignees.forEach(assignee => {
          if (assignee) {
            repoContext.slack.updateHome(assignee.login);
          }
        });
      }

      if (!updatedPr.assignees || !updatedPr.assignees.some(assignee => assignee && assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }
    }

    if (repoContext.slack) {
      if (sender.login === reviewer.login) {
        pullRequest.assignees.forEach(assignee => {
          repoContext.slack.postMessage('pr-review', assignee, {
            text: `:recycle: ${repoContext.slack.mention(reviewer.login)} dismissed his review on ${createPrLink(pullRequest, repoContext)}`
          });
        });
      } else {
        repoContext.slack.postMessage('pr-review', reviewer, {
          text: `:recycle: ${repoContext.slack.mention(sender.login)} dismissed your review on ${createPrLink(pullRequest, repoContext)}`
        });
      }
    }
  }));
}

function reviewRequestRemoved(app, appContext) {
  app.on('pull_request.review_request_removed', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext) => {
    const sender = context.payload.sender;
    const requestedReviewer = context.payload.requested_reviewer;
    const requestedTeam = context.payload.requested_team;
    const requestedReviewers = requestedReviewer ? [requestedReviewer] : await repoContext.getMembersForTeam(requestedTeam.id);
    const reviewerGroup = requestedReviewer ? repoContext.getReviewerGroup(requestedReviewer.login) : repoContext.getTeamGroup(requestedTeam.name);

    if (!repoContext.shouldIgnore && reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.approveShouldWait(reviewerGroup, pullRequest, {
        includesReviewerGroup: true
      });
      const {
        reviewStates
      } = await getReviewersAndReviewStates(context, repoContext);
      const hasChangesRequestedInReviews = reviewStates[reviewerGroup].changesRequested !== 0;
      const hasApprovedInReviews = reviewStates[reviewerGroup].approved !== 0;
      const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && hasApprovedInReviews;
      await updateReviewStatus(pullRequest, context, repoContext, reviewerGroup, {
        add: [// if changes requested by the one which requests was removed (should still be in changed requested anyway, but we never know)
        hasChangesRequestedInReviews && 'changesRequested', // if was already approved by another member in the group and has no other requests waiting
        approved && 'approved'],
        // remove labels if has no other requests waiting
        remove: [approved && 'needsReview', !hasRequestedReviewsForGroup && 'requested']
      });
      const assigneesLogins = [];

      if (pullRequest.assignees) {
        pullRequest.assignees.forEach(assignee => {
          assigneesLogins.push(assignee.login);
          repoContext.slack.updateHome(assignee.login);
        });
      }

      requestedReviewers.forEach(potentialReviewer => {
        if (assigneesLogins.includes(potentialReviewer)) return;
        repoContext.slack.updateHome(potentialReviewer.login);
      });
    }

    if (repoContext.slack) {
      if (requestedReviewers.some(rr => rr.login === sender.login)) {
        requestedReviewers.forEach(potentialReviewer => {
          if (potentialReviewer.login === sender.login) return;
          repoContext.slack.postMessage('pr-review', potentialReviewer, {
            text: `:skull_and_crossbones: ${repoContext.slack.mention(sender.login)} removed the request for your team _${requestedTeam.name}_ review on ${createPrLink(pullRequest, repoContext)}`
          });
        });
      } else {
        requestedReviewers.forEach(potentialReviewer => {
          repoContext.slack.postMessage('pr-review', potentialReviewer, {
            text: `:skull_and_crossbones: ${repoContext.slack.mention(sender.login)} removed the request for  ${requestedTeam ? `your team _${requestedTeam.name}_` : 'your'} review on ${createPrLink(pullRequest, repoContext)}`
          });
        });
      }

      await Promise.all(requestedReviewers.map(async potentialReviewer => {
        const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne({
          'account.id': repoContext.accountEmbed.id,
          'account.type': repoContext.accountEmbed.type,
          type: 'review-requested',
          typeId: `${pullRequest.id}_${requestedTeam ? `${requestedTeam.id}_` : ''}${potentialReviewer.id}`
        });

        if (sentMessageRequestedReview) {
          const sentTo = sentMessageRequestedReview.sentTo[0];
          const message = sentMessageRequestedReview.message;
          await Promise.all([repoContext.slack.updateMessage(sentMessageRequestedReview.account, sentTo.ts, sentTo.channel, { ...message,
            text: message.text.split('\n').map(l => `~${l}~`).join('\n')
          }), repoContext.slack.addReaction(sentMessageRequestedReview.account, sentTo.ts, sentTo.channel, 'skull_and_crossbones'), appContext.mongoStores.slackSentMessages.deleteOne(sentMessageRequestedReview)]);
        }
      }));
    }
  }));
}

function reviewRequested(app, appContext) {
  app.on('pull_request.review_requested', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext) => {
    const sender = context.payload.sender;
    const requestedReviewer = context.payload.requested_reviewer;
    const requestedTeam = context.payload.requested_team;
    const requestedReviewers = requestedReviewer ? [requestedReviewer] : await repoContext.getMembersForTeam(requestedTeam.id);
    const reviewerGroup = requestedReviewer ? repoContext.getReviewerGroup(requestedReviewer.login) : repoContext.getTeamGroup(requestedTeam.name);

    // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });
    if (!repoContext.shouldIgnore && reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      await updateReviewStatus(pullRequest, context, repoContext, reviewerGroup, {
        add: ['needsReview', "requested"],
        remove: ['approved']
      });
      const assigneesLogins = [];

      if (pullRequest.assignees) {
        pullRequest.assignees.forEach(assignee => {
          assigneesLogins.push(assignee.login);
          repoContext.slack.updateHome(assignee.login);
        });
      }

      requestedReviewers.forEach(potentialReviewer => {
        if (assigneesLogins.includes(potentialReviewer)) return;
        repoContext.slack.updateHome(potentialReviewer.login);
      });
    }

    if (repoContext.slack) {
      const text = `:eyes: ${repoContext.slack.mention(sender.login)} requests ${requestedReviewer ? 'your' : `your team _${requestedTeam.name}_`} review on ${createPrLink(pullRequest, repoContext)} !\n> ${pullRequest.title}`;
      const message = {
        text
      };
      await Promise.all(requestedReviewers.map(async potentialReviewer => {
        if (sender.login === potentialReviewer.login) return;
        const result = await repoContext.slack.postMessage('pr-review', potentialReviewer, message);

        if (result) {
          await appContext.mongoStores.slackSentMessages.insertOne({
            type: 'review-requested',
            typeId: `${pullRequest.id}_${requestedTeam ? `${requestedTeam.id}_` : ''}${potentialReviewer.id}`,
            message,
            account: repoContext.accountEmbed,
            sentTo: [result]
          });
        }
      }));
    }
  }));
}

const getEmojiFromState = state => {
  switch (state) {
    case 'changes_requested':
      return 'x';

    case 'approved':
      return 'white_check_mark';

    default:
      return 'speech_balloon';
  }
};

function reviewSubmitted(app, appContext) {
  app.on('pull_request_review.submitted', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    const {
      payload
    } = context;
    const {
      user: reviewer,
      state,
      body,
      html_url: reviewUrl
    } = payload.review;
    const {
      reviewers,
      reviewStates
    } = await getReviewersAndReviewStates(context, repoContext);
    const {
      owner,
      assignees,
      followers
    } = getRolesFromPullRequestAndReviewers(pullRequest, reviewers);
    const isReviewByOwner = owner.login === reviewer.login;
    const filteredFollowers = followers.filter(follower => follower.id !== reviewer.id);

    if (!isReviewByOwner) {
      const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
      let merged;

      if (reviewflowPrContext && !repoContext.shouldIgnore && reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
        const hasRequestedReviewsForGroup = repoContext.approveShouldWait(reviewerGroup, pullRequest, {
          includesReviewerGroup: true // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
          // includesWaitForGroups: true,

        });
        const hasChangesRequestedInReviews = reviewStates[reviewerGroup].changesRequested !== 0;
        const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && state === 'approved';
        const updatedPr = await fetchPr(context, pullRequest.number);
        const newLabels = await updateReviewStatus(updatedPr, context, repoContext, reviewerGroup, {
          add: [approved && 'approved', state === 'changes_requested' && 'needsReview', state === 'changes_requested' && 'changesRequested'],
          remove: [approved && 'needsReview', !hasRequestedReviewsForGroup && 'requested', state === 'approved' && !hasChangesRequestedInReviews && 'changesRequested', state === 'changes_requested' && 'approved']
        });

        if (approved && !hasChangesRequestedInReviews) {
          merged = await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext, newLabels);
        }
      }

      if (assignees) {
        assignees.forEach(assignee => {
          repoContext.slack.updateHome(assignee.login);
        });
      }

      if (!assignees.some(assignee => assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }

      const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne({
        'account.id': repoContext.accountEmbed.id,
        'account.type': repoContext.accountEmbed.type,
        type: 'review-requested',
        typeId: `${pullRequest.id}_${reviewer.id}`
      });
      const emoji = getEmojiFromState(state);

      if (sentMessageRequestedReview) {
        const sentTo = sentMessageRequestedReview.sentTo[0];
        const message = sentMessageRequestedReview.message;
        await Promise.all([repoContext.slack.updateMessage(sentMessageRequestedReview.account, sentTo.ts, sentTo.channel, { ...message,
          text: message.text.split('\n').map(l => `~${l}~`).join('\n')
        }), repoContext.slack.addReaction(sentMessageRequestedReview.account, sentTo.ts, sentTo.channel, emoji), appContext.mongoStores.slackSentMessages.deleteOne(sentMessageRequestedReview)]);
      }

      if (!body && state !== 'changes_requested' && state !== 'approved') {
        return;
      }

      const mention = repoContext.slack.mention(reviewer.login);
      const prUrl = createPrLink(pullRequest, repoContext);
      const ownerMention = repoContext.slack.mention(owner.login);

      const createMessage = (toOwner, isAssignedTo) => {
        const ownerPart = toOwner ? 'your PR' : `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ''}`;

        if (state === 'changes_requested') {
          return `:${emoji}: ${mention} requests changes on ${ownerPart} ${prUrl}`;
        }

        if (state === 'approved') {
          return `${toOwner ? ':clap: ' : ''}:${emoji}: ${mention} approves ${ownerPart} ${prUrl}${merged ? ' and PR is merged :tada:' : ''}`;
        }

        const commentLink = createLink(reviewUrl, 'commented');
        return `:${emoji}: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
      };

      const slackifiedBody = slackifyMarkdown__default(body);
      assignees.forEach(assignee => {
        repoContext.slack.postMessage('pr-review', assignee, createSlackMessageWithSecondaryBlock(createMessage(assignee.id === owner.id, true), slackifiedBody));
      });
      const message = createSlackMessageWithSecondaryBlock(createMessage(false), slackifiedBody);
      filteredFollowers.forEach(follower => {
        repoContext.slack.postMessage('pr-review-follow', follower, message);
      });
    } else if (body) {
      const mention = repoContext.slack.mention(reviewer.login);
      const prUrl = createPrLink(pullRequest, repoContext);
      const commentLink = createLink(reviewUrl, 'commented');
      const message = createSlackMessageWithSecondaryBlock(`:speech_balloon: ${mention} ${commentLink} on his PR ${prUrl}`, body);
      filteredFollowers.forEach(follower => {
        repoContext.slack.postMessage('pr-review-follow', follower, message);
      });
    }
  }));
}

const isSameBranch = (payload, lockedPr) => {
  if (!lockedPr) return false;
  return !!payload.branches.some(b => b.name === lockedPr.branch);
};

function status(app, appContext) {
  app.on('status', createPullRequestsHandler(appContext, (payload, repoContext) => {
    if (repoContext.shouldIgnore) return [];
    const lockedPr = repoContext.getMergeLockedPr();
    if (!lockedPr) return [];

    if (payload.state !== 'loading' && isSameBranch(payload, lockedPr)) {
      return [lockedPr];
    }

    return [];
  }, (pr, context, repoContext) => {
    const lockedPr = repoContext.getMergeLockedPr(); // check if changed

    if (isSameBranch(context.payload, lockedPr)) {
      repoContext.reschedule(context, lockedPr);
    }
  }));
}

function synchronize(app, appContext) {
  app.on('pull_request.synchronize', createPullRequestHandler(appContext, (payload, context, repoContext) => {
    if (repoContext.shouldIgnore) return null;
    return payload.pull_request;
  }, async (pullRequest, context, repoContext, reviewflowPrContext) => {
    if (!reviewflowPrContext) return;
    const updatedPr = await fetchPr(context, pullRequest.number); // old and new sha
    // const { before, after } = context.payload;

    const previousSha = context.payload.before;
    await Promise.all([editOpenedPR(updatedPr, context, repoContext, reviewflowPrContext, true, previousSha), // addStatusCheckToLatestCommit
    updateStatusCheckFromLabels(updatedPr, context, repoContext, updatedPr.labels, previousSha)]); // call autoMergeIfPossible to re-add to the queue when push is fixed

    await autoMergeIfPossible(updatedPr, context, repoContext, reviewflowPrContext);
  }));
}

function repoEdited(app, appContext) {
  app.on('repository.edited', createHandlerOrgChange(appContext, async context => {
    const repoContext = await obtainRepoContext(appContext, context);
    if (!repoContext) return;
    const repo = context.payload.repository;
    repoContext.repoFullName = repo.full_name;
    repoContext.repoEmoji = getEmojiFromRepoDescription(repo.description);
  }));
}

// import commands from 'probot-commands';
function initApp(app, appContext) {
  // Account

  /* https://developer.github.com/webhooks/event-payloads/#organization */

  /* https://developer.github.com/webhooks/event-payloads/#team */

  /* https://developer.github.com/webhooks/event-payloads/#membership */
  orgMemberAddedOrRemoved(app, appContext);
  teamChanged(app, appContext);
  membershipChanged(app, appContext); // Repo

  /* https://developer.github.com/webhooks/event-payloads/#repository */

  repoEdited(app, appContext); // PR

  /* https://developer.github.com/webhooks/event-payloads/#pull_request */

  opened(app, appContext);
  edited(app, appContext);
  closed(app, appContext);
  reopened(app, appContext);
  reviewRequested(app, appContext);
  reviewRequestRemoved(app, appContext);
  reviewSubmitted(app, appContext);
  reviewDismissed(app, appContext);
  labelsChanged(app, appContext);
  synchronize(app, appContext);
  /* https://developer.github.com/webhooks/event-payloads/#pull_request_review_comment */

  /* https://developer.github.com/webhooks/event-payloads/#issue_comment */

  prCommentCreated(app, appContext);
  prCommentEditedOrDeleted(app, appContext);
  /* https://developer.github.com/webhooks/event-payloads/#check_run */

  checkrunCompleted(app, appContext);
  /* https://developer.github.com/webhooks/event-payloads/#check_suite */

  checksuiteCompleted(app, appContext);
  /* https://developer.github.com/webhooks/event-payloads/#status */

  status(app, appContext);
  /* commands */
  // commands(app, 'update-branch', () => {});
}

/* eslint-disable @typescript-eslint/no-floating-promises */

if (!process.env.MONGO_DB) {
  throw new Error('MONGO_DB is missing in process.env');
}

function init() {
  const config = new Map([['host', process.env.MONGO_HOST || 'localhost'], ['port', process.env.MONGO_PORT || '27017'], ['database', process.env.MONGO_DB]]);

  if (process.env.MONGO_USER) {
    config.set('user', process.env.MONGO_USER);
    config.set('password', process.env.MONGO_PASSWORD);
  }

  const connection = new liwiMongo.MongoConnection(config); // const prEvents = new MongoStore<PrEventsModel>(connection, 'prEvents');
  // prEvents.collection.then((coll) => {
  //   coll.createIndex({ owner: 1, repo: 1, ???: 1 });
  // });

  const userDmSettings = new liwiMongo.MongoStore(connection, 'userDmSettings');
  userDmSettings.collection.then(coll => {
    coll.createIndex({
      userId: 1,
      orgId: 1
    }, {
      unique: true
    });
  });
  const users = new liwiMongo.MongoStore(connection, 'users');
  users.collection.then(coll => {
    coll.createIndex({
      login: 1
    }, {
      unique: true
    });
  });
  const orgs = new liwiMongo.MongoStore(connection, 'orgs');
  orgs.collection.then(coll => {
    coll.createIndex({
      login: 1
    }, {
      unique: true
    });
  });
  const orgMembers = new liwiMongo.MongoStore(connection, 'orgMembers');
  orgMembers.collection.then(coll => {
    coll.createIndex({
      'user.id': 1,
      'org.id': 1
    }, {
      unique: true
    });
    coll.createIndex({
      'org.id': 1,
      'user.id': 1,
      'teams.id': 1
    }, {
      unique: true
    });
    coll.createIndex({
      'org.id': 1,
      'teams.id': 1
    });
  });
  const orgTeams = new liwiMongo.MongoStore(connection, 'orgTeams');
  orgTeams.collection.then(coll => {
    coll.createIndex({
      'org.id': 1
    });
  });
  const slackSentMessages = new liwiMongo.MongoStore(connection, 'slackSentMessages');
  slackSentMessages.collection.then(coll => {
    coll.createIndex({
      'account.id': 1,
      'account.type': 1,
      type: 1,
      typeId: 1
    }); // remove older than 14 days

    coll.deleteMany({
      created: {
        $lt: new Date(Date.now() - 1209600000)
      }
    });
  });
  const automergeLogs = new liwiMongo.MongoStore(connection, 'automergeLogs');
  automergeLogs.collection.then(coll => {
    coll.createIndex({
      repoFullName: 1,
      type: 1
    });
    coll.createIndex({
      repoFullName: 1,
      'pr.number': 1
    }); // remove older than 30 days

    coll.deleteMany({
      created: {
        $lt: new Date(Date.now() - 2592000000)
      }
    });
  });
  const prs = new liwiMongo.MongoStore(connection, 'prs');
  prs.collection.then(coll => {
    coll.createIndex({
      'account.id': 1,
      'repo.id': 1,
      'pr.number': 1
    }, {
      unique: true
    }); // remove older than 12 * 30 days

    coll.deleteMany({
      created: {
        $lt: new Date(Date.now() - 31104000000)
      }
    });
  });
  const slackTeams = new liwiMongo.MongoStore(connection, 'slackTeams');
  const slackTeamInstallations = new liwiMongo.MongoStore(connection, 'slackTeamsInstallations'); // return { connection, prEvents };

  return {
    connection,
    userDmSettings,
    users,
    orgs,
    orgMembers,
    orgTeams,
    slackTeams,
    slackTeamInstallations,
    slackSentMessages,
    automergeLogs,
    prs
  };
}

const createSlackHomeWorker = mongoStores => {
  const updateMember = async (octokit, slackClient, member) => {
    var _member$slack;

    if (!((_member$slack = member.slack) !== null && _member$slack !== void 0 && _member$slack.id)) return; // console.log('update member', member.org.login, member.user.login);

    /* search limit: 30 requests per minute = 7 update/min max */

    const [prsWithRequestedReviews, prsToMerge, prsWithRequestedChanges, prsInDraft] = await Promise.all([octokit.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open review-requested:${member.user.login} `,
      sort: 'created',
      order: 'desc'
    }), octokit.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open assignee:${member.user.login} label:":ok_hand: code/approved"`,
      sort: 'created',
      order: 'desc'
    }), octokit.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open assignee:${member.user.login} label:":ok_hand: code/changes-requested"`,
      sort: 'created',
      order: 'desc'
    }), octokit.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open assignee:${member.user.login} draft:true`,
      sort: 'created',
      order: 'desc',
      per_page: 5
    })]);
    const blocks = [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Configure your ${process.env.REVIEWFLOW_NAME} settings ${createLink(`${process.env.REVIEWFLOW_APP_URL}/${member.org.login}`, 'here')}.`
      }
    }, {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'PRs requesting your attention'
      }
    }];

    const buildBlocks = (title, results) => {
      if (!results.total_count) return;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`
        }
      }, {
        type: 'divider'
      }, ...results.items.flatMap(pr => {
        const repoName = pr.repository_url.slice(29);
        const prFullName = `${repoName}#${pr.number}`;
        return [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${createLink(pr.html_url, pr.title)}*` //  ${pr.labels.map((l) => `{${l.name}}`).join(' · ')}

          }
        }, {
          type: 'context',
          elements: [{
            type: 'mrkdwn',
            text: `${createLink(pr.html_url, prFullName)} ${pr.draft ? '· _Draft_' : ''}`
          }, {
            type: 'image',
            image_url: pr.user.avatar_url,
            alt_text: pr.user.login
          }, {
            type: 'mrkdwn',
            text: `${pr.user.login}`
          }]
        }];
      }), {
        type: 'context',
        elements: [{
          type: 'image',
          image_url: 'https://api.slack.com/img/blocks/bkb_template_images/placeholder.png',
          alt_text: 'placeholder'
        }]
      });
    };

    buildBlocks(':eyes: Requested Reviews', prsWithRequestedReviews.data);
    buildBlocks(':white_check_mark: Ready to Merge', prsToMerge.data);
    buildBlocks(':x: Changes Requested', prsWithRequestedChanges.data);
    buildBlocks(':construction: Drafts', prsInDraft.data);

    if (blocks.length === 2) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ":tada: It looks like you don't have any PR to review!"
        }
      });
    }

    slackClient.views.publish({
      user_id: member.slack.id,
      view: {
        type: 'home',
        blocks
      }
    });
  };

  let workerInterval;
  const queueKeys = new Set();
  const queue = [];

  const stop = () => {
    if (workerInterval !== undefined) {
      clearInterval(workerInterval);
      workerInterval = undefined;
    }
  };

  const start = () => {
    if (workerInterval !== undefined) return;
    workerInterval = setInterval(() => {
      var _member$slack2;

      const item = queue.shift();

      if (!item) {
        stop();
        return;
      }

      const {
        github,
        slackClient,
        member
      } = item;
      const memberId = (_member$slack2 = member.slack) === null || _member$slack2 === void 0 ? void 0 : _member$slack2.id;
      const key = `${member.org.id}_${memberId}`;
      queueKeys.delete(key);
      updateMember(github, slackClient, member);
    }, 9000); // 7/min 60s 1min = 1 ttes les 8.5s max
  };

  const scheduleUpdateMember = (github, slackClient, member) => {
    var _member$slack3;

    const memberId = (_member$slack3 = member.slack) === null || _member$slack3 === void 0 ? void 0 : _member$slack3.id;
    if (!memberId) return;
    const key = `${member.org.id}_${memberId}`;

    if (!queueKeys.has(key)) {
      queueKeys.add(key);
      queue.push({
        github,
        slackClient,
        member
      });
      start();
    }
  };

  const scheduleUpdateOrg = async (github, org, slackClient = new webApi.WebClient(org.slackToken)) => {
    const cursor = await mongoStores.orgMembers.cursor();
    cursor.forEach(member => {
      scheduleUpdateMember(github, slackClient, member);
    });
  };

  return {
    scheduleUpdateMember,
    scheduleUpdateOrg,
    scheduleUpdateAllOrgs: async auth => {
      const cursor = await mongoStores.orgs.cursor();
      cursor.forEach(async org => {
        if (!org.slackToken || !org.installationId) return;
        const github = await auth(org.installationId);
        await scheduleUpdateOrg(github, org);
      });
    }
  };
};

/* eslint-disable @typescript-eslint/no-floating-promises */
if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow'; // eslint-disable-next-line no-console

console.log({
  name: process.env.REVIEWFLOW_NAME
}); // const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');
// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));
// let config = await getConfig(context, 'reviewflow.yml');

probot.run((app, {
  getRouter
}) => {
  const mongoStores = init();
  const slackHome = createSlackHomeWorker(mongoStores);
  const appContext = {
    mongoStores,
    slackHome
  };
  appRouter(app, getRouter, appContext);
  initApp(app, appContext);
  slackHome.scheduleUpdateAllOrgs(id => app.auth(id));
});
//# sourceMappingURL=index-node12.cjs.js.map
