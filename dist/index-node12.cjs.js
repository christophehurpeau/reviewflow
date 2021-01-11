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

const oauth2 = simpleOauth2.create({
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
  }, children)));
}

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY;
const signPromisified = util.promisify(jsonwebtoken.sign);
const verifyPromisified = util.promisify(jsonwebtoken.verify);
const secure = !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== 'false';

const createRedirectUri = req => {
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
  router.get('/login', async (req, res) => {
    if (await getAuthInfoFromCookie(req, res)) {
      return res.redirect('/app');
    } // const state = await randomHex(8);
    // res.cookie(`auth_${strategy}_${state}`, strategy, {
    //   maxAge: 10 * 60 * 1000,
    //   httpOnly: true,
    //   secure,
    // });


    const redirectUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: createRedirectUri(req),
      scope: 'read:user,repo' // state,
      // grant_type: options.grantType,
      // access_type: options.accessType,
      // login_hint: req.query.loginHint,
      // include_granted_scopes: options.includeGrantedScopes,

    }); // console.log(redirectUri);

    res.redirect(redirectUri);
  });
  router.get('/login-response', async (req, res) => {
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

    const result = await oauth2.authorizationCode.getToken({
      code,
      redirect_uri: createRedirectUri(req)
    });

    if (!result) {
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, "Could not get access token. ", /*#__PURE__*/React__default.createElement("a", {
        href: "/app/login"
      }, "Retry ?")))));
      return;
    }

    const accessToken = result.access_token;
    const api = createApi(accessToken);
    const user = await api.users.getAuthenticated({});
    const id = user.data.id;
    const login = user.data.login;
    const authInfo = {
      id,
      login,
      accessToken,
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
  });
}

function home(router) {
  router.get('/', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
    const orgs = await user.api.orgs.listForAuthenticatedUser();
    res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("h1", null, process.env.REVIEWFLOW_NAME), /*#__PURE__*/React__default.createElement("div", {
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
    }, org.login))))))))));
  });
}

const config = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(revert: )?(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\(([/a-z-]*)\))?(!)?:\s/,
      error: {
        title: 'Title does not match commitlint conventional',
        summary: 'https://www.npmjs.com/package/@commitlint/config-conventional'
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
        name: 'automerge/skip-ci',
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

const config$1 = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
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

const config$2 = {
  autoAssignToCreator: true,
  trimTitle: true,
  ignoreRepoPattern: '(infra-.*|devenv)',
  requiresReviewRequest: true,
  autoMergeRenovateWithSkipCi: false,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(revert: )?(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\(([/a-z-]*)\))?:\s/,
      error: {
        title: 'Title does not match commitlint conventional',
        summary: 'https://www.npmjs.com/package/@commitlint/config-conventional'
      }
    }, {
      bot: false,
      regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no issue])$/,
      error: {
        title: 'Title does not have JIRA issue',
        summary: 'The PR title should end with ONK-0000, or [no issue]'
      },
      status: 'jira-issue',
      statusInfoFromMatch: match => {
        const issue = match[1];

        if (issue === '[no issue]') {
          return {
            title: 'No issue',
            summary: ''
          };
        }

        return {
          inBody: true,
          url: `https://ornikar.atlassian.net/browse/${issue}`,
          title: `JIRA issue: ${issue}`,
          summary: `[${issue}](https://ornikar.atlassian.net/browse/${issue})`
        };
      }
    }]
  },
  botUsers: ['michael-robot'],
  groups: {
    dev: {
      /* ops */
      JulienBreux: `julien.breux${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      TheR3aLp3nGuinJM: `jean-michel${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* back */
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Thierry-girod': `thierry${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      darame07: `kevin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Pixy: `pierre-alexis${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      machartier: `marie-anne${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      camillebaronnet: `camille.baronnet${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* front */
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      vlbr: `valerian${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'budet-b': `benjamin.budet${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      mdcarter: `maxime.dehaye${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      ChibiBlasphem: `christopher${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      PSniezak: `paul.sniezak${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      GaelFerrand: 'gael.ferrand@othrys.dev'
    },
    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Lenamari: `lena${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      loicleser: null
    }
  },
  teams: {
    ops: {
      logins: ['JulienBreux', 'Alan-pad', 'CamilSadiki', 'busser'],
      labels: ['teams/ops']
    },
    backends: {
      logins: ['abarreir', 'arthurflachs', 'damienorny', 'Thierry-girod', 'darame07', 'Pixy', 'Radyum', 'camillebaronnet'],
      labels: ['teams/backend']
    },
    frontends: {
      logins: ['christophehurpeau', 'HugoGarrido', 'LentnerStefan', 'CorentinAndre', 'Mxime', 'vlbr', 'budet-b', 'mdcarter', 'ChibiBlasphem', 'PSniezak'],
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
        name: 'automerge/skip-ci',
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

const config$3 = { ...config,
  requiresReviewRequest: true,
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com'
    }
  }
};

const accountConfigs = {
  ornikar: config$2,
  christophehurpeau: config,
  reviewflow: config$3
};
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };

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
  const accountConfig = accountConfigs[org] || config$1;
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
    const currentIterationMemberIds = data.map(member => member.id);
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
  router.get('/org/:org/force-sync', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find(o => o.login === req.params.org);
    if (!org) return res.redirect('/app');
    const o = await mongoStores.orgs.findByKey(org.id);
    if (!o) return res.redirect('/app');
    await syncOrg(mongoStores, user.api, o.installationId, org);
    await syncTeamsAndTeamMembers(mongoStores, user.api, org);
    res.redirect(`/app/org/${req.params.org}`);
  });
  router.get('/org/:org', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find(o => o.login === req.params.org);
    if (!org) return res.redirect('/app');
    const installation = await octokitApp.apps.getOrgInstallation({
      org: org.login
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

    const accountConfig = accountConfigs[org.login];
    const userDmSettings = await getUserDmSettings(mongoStores, org.login, org.id, user.authInfo.id);
    res.send(server.renderToStaticMarkup( /*#__PURE__*/React__default.createElement(Layout, null, /*#__PURE__*/React__default.createElement("div", null, /*#__PURE__*/React__default.createElement("h1", null, process.env.REVIEWFLOW_NAME), /*#__PURE__*/React__default.createElement("div", {
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
    }, /*#__PURE__*/React__default.createElement("h4", null, "Information"), !accountConfig ? 'Default config is used: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/defaultConfig.ts' : `Custom config: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/${org.login}.ts`), /*#__PURE__*/React__default.createElement("div", {
      style: {
        width: '380px'
      }
    }, /*#__PURE__*/React__default.createElement("h4", null, "My DM Settings"), Object.entries(dmMessages).map(([key, name]) => /*#__PURE__*/React__default.createElement("div", {
      key: key
    }, /*#__PURE__*/React__default.createElement("label", {
      htmlFor: key
    }, /*#__PURE__*/React__default.createElement("span", {
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML: {
        __html: `<input id="${key}" type="checkbox" autocomplete="off" ${userDmSettings[key] ? 'checked="checked" ' : ''}onclick="fetch(location.pathname, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '${key}', value: event.currentTarget.checked }) })" />`
      }
    }), name)))))))));
  });
  router.patch('/org/:org', bodyParser__default.json(), async (req, res) => {
    if (!req.body) {
      res.status(400).send('not ok');
      return;
    }

    const user = await getUser(req, res);
    if (!user) return;
    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find(o => o.login === req.params.org);
    if (!org) return res.redirect('/app');
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
  });
}

function repository(router, octokitApp) {
  router.get('/repositories', async (req, res) => {
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
  });
  router.get('/repository/:owner/:repository', async (req, res) => {
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
  });
}

const syncUser = async (mongoStores, github, installationId, userInfo) => {
  const user = await mongoStores.users.upsertOne({
    _id: userInfo.id,
    login: userInfo.login,
    type: 'User',
    installationId
  });
  return user;
};

function userSettings(router, octokitApp, mongoStores) {
  router.get('/user/force-sync', async (req, res) => {
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
    if (!u || !u.installationId) return res.redirect('/app');
    await syncUser(mongoStores, user.api, u.installationId, user.authInfo);
    res.redirect('/app/user');
  });
  router.get('/user', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
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
}

const ExcludesFalsy = Boolean;
const ExcludesNullish = res => res !== null;

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
  updateHome: () => undefined
});

const initTeamSlack = async ({
  mongoStores,
  slackHome
}, context, config, account) => {
  const slackToken = 'slackToken' in account && account.slackToken;

  if (!slackToken) {
    return voidTeamSlack();
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});
  const slackEmails = Object.values(githubLoginToSlackEmail);
  const slackClient = new webApi.WebClient(slackToken);
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
      members.push([email, {
        member: {
          id: member.slack.id
        },
        im: undefined
      }]);
    }
  });

  if (foundEmailMembers.length !== slackEmails.length) {
    const missingEmails = slackEmails.filter(email => !foundEmailMembers.includes(email));
    const memberEmailToMemberId = new Map(Object.entries(githubLoginToSlackEmail).map(([login, email]) => {
      var _membersInDb$find;

      return [email, (_membersInDb$find = membersInDb.find(m => m.user.login === login)) === null || _membersInDb$find === void 0 ? void 0 : _membersInDb$find._id];
    }));
    await slackClient.paginate('users.list', {}, page => {
      page.members.forEach(member => {
        var _member$profile;

        const email = (_member$profile = member.profile) === null || _member$profile === void 0 ? void 0 : _member$profile.email;

        if (email && missingEmails.includes(email)) {
          members.push([email, {
            member,
            im: undefined
          }]);

          if (memberEmailToMemberId.has(email)) {
            mongoStores.orgMembers.partialUpdateMany({
              _id: memberEmailToMemberId.get(email)
            }, {
              $set: {
                slack: {
                  id: member.id
                }
              }
            });
          }
        }
      });
      return false;
    });
  }

  for (const [, user] of members) {
    try {
      const im = await slackClient.conversations.open({
        users: user.member.id
      });
      user.im = im.channel;
    } catch (err) {
      console.error(err);
    }
  }

  const membersMap = new Map(members);

  const getUserFromGithubLogin = githubLogin => {
    const email = githubLoginToSlackEmail[githubLogin];
    if (!email) return null;
    return membersMap.get(email);
  };

  return {
    mention: githubLogin => {
      // TODO pass AccountInfo instead
      if (githubLogin.endsWith('[bot]')) {
        return `:robot_face: ${githubLogin.slice(0, -5)}`;
      }

      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (category, githubId, githubLogin, message) => {
      context.log.debug({
        category,
        githubLogin,
        message
      }, 'slack: post message');
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;
      const userDmSettings = await getUserDmSettings(mongoStores, account.login, account._id, githubId);
      if (!userDmSettings[category]) return null;
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return null;
      const result = await slackClient.chat.postMessage({
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
    updateMessage: async (ts, channel, message) => {
      context.log.debug({
        ts,
        channel,
        message
      }, 'slack: update message');
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;
      const result = await slackClient.chat.update({
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
    deleteMessage: async (ts, channel) => {
      context.log.debug({
        ts,
        channel
      }, 'slack: delete message');
      await slackClient.chat.delete({
        ts,
        channel
      });
    },
    addReaction: async (ts, channel, name) => {
      context.log.debug({
        ts,
        channel,
        name
      }, 'slack: add reaction');
      await slackClient.reactions.add({
        timestamp: ts,
        channel,
        name
      });
    },
    updateHome: githubLogin => {
      context.log.debug({
        githubLogin
      }, 'update slack home');
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.member) return;
      slackHome.scheduleUpdateMember(context.octokit, slackClient, {
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
    }
  };
};

const initAccountContext = async (appContext, context, config, accountInfo) => {
  const account = await getOrCreateAccount(appContext, context.octokit, context.payload.installation.id, accountInfo);
  const slackPromise = initTeamSlack(appContext, context, config, account);
  const githubLoginToGroup = new Map();
  getKeys(config.groups).forEach(groupName => {
    Object.keys(config.groups[groupName]).forEach(login => {
      githubLoginToGroup.set(login, groupName);
    });
  });
  const githubLoginToTeams = new Map();
  getKeys(config.teams || {}).forEach(teamName => {
    config.teams[teamName].logins.forEach(login => {
      const teams = githubLoginToTeams.get(login);

      if (teams) {
        teams.push(teamName);
      } else {
        githubLoginToTeams.set(login, [teamName]);
      }
    });
  });

  const getReviewerGroups = githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(ExcludesFalsy))];

  const lock$1 = lock.Lock();
  return {
    config,
    account,
    accountEmbed: {
      id: accountInfo.id,
      login: accountInfo.login,
      type: accountInfo.type
    },
    accountType: accountInfo.type,
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
    getTeamsForLogin: githubLogin => githubLoginToTeams.get(githubLogin) || [],
    approveShouldWait: (reviewerGroup, pullRequest, {
      includesReviewerGroup,
      includesWaitForGroups
    }) => {
      if (!reviewerGroup) return false;
      const requestedReviewerGroups = getReviewerGroups(pullRequest.requested_reviewers.map(request => request.login)); // TODO pullRequest.requested_teams
      // contains another request of a reviewer in the same group

      if (includesReviewerGroup && requestedReviewerGroups.includes(reviewerGroup)) {
        return true;
      } // contains a request from a dependent group


      if (config.waitForGroups && includesWaitForGroups) {
        const waitForGroups = config.waitForGroups;
        return requestedReviewerGroups.some(group => waitForGroups[reviewerGroup].includes(group));
      }

      return false;
    },
    slack: await slackPromise
  };
};

const accountContextsPromise = new Map();
const accountContexts = new Map();
const obtainAccountContext = (appContext, context, config, accountInfo) => {
  const existingAccountContext = accountContexts.get(accountInfo.login);
  if (existingAccountContext) return existingAccountContext;
  const existingPromise = accountContextsPromise.get(accountInfo.login);
  if (existingPromise) return Promise.resolve(existingPromise);
  const promise = initAccountContext(appContext, context, config, accountInfo);
  accountContextsPromise.set(accountInfo.login, promise);
  return promise.then(accountContext => {
    accountContextsPromise.delete(accountInfo.login);
    accountContexts.set(accountInfo.login, accountContext);
    return accountContext;
  });
};

const handlerOrgChange = async (appContext, context, callback) => {
  const org = context.payload.organization;
  if (!org) return;
  const config = accountConfigs[org.login] || config$1;
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

const options = ['featureBranch', 'autoMergeWithSkipCi', 'autoMerge', 'deleteAfterMerge'];
const optionsRegexps = options.map(option => ({
  key: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`)
}));
const optionsLabels = [{
  key: 'featureBranch',
  label: 'This PR is a feature branch'
}, {
  key: 'autoMergeWithSkipCi',
  label: 'Add `[skip ci]` on merge commit'
}, {
  key: 'autoMerge',
  label: 'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)'
}, {
  key: 'deleteAfterMerge',
  label: 'Automatic branch delete after this PR is merged'
}];

const parseOptions = (content, defaultOptions) => {
  return optionsRegexps.reduce((acc, {
    key,
    regexp
  }) => {
    const match = regexp.exec(content);
    acc[key] = !match ? defaultOptions[key] || false : match[1] === 'x' || match[1] === 'X';
    return acc;
  }, {});
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

  if (pullRequest.requested_reviewers.length > 0) {
    repoContext.removePrFromAutomergeQueue(context, pullRequest.number, 'still has requested reviewers');
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
        addLog('rebase-renovate', 'wait'); // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120

        if (pullRequest.body.includes('<!-- rebase-check -->')) {
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
      context.log.info({
        head: pullRequest.head.ref,
        base: pullRequest.base.ref
      }, 'automerge not possible: update branch');
      await context.octokit.repos.merge({
        owner: pullRequest.head.repo.owner.login,
        repo: pullRequest.head.repo.name,
        head: pullRequest.base.ref,
        base: pullRequest.head.ref
      });
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
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
      commit_title: options.featureBranch ? undefined : `${pullRequest.title}${options.autoMergeWithSkipCi ? ' [skip ci]' : ''} (#${pullRequest.number})`,
      commit_message: options.featureBranch ? undefined : '' // TODO add BC

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

const toMarkdownOptions = options => {
  return optionsLabels.map(({
    key,
    label
  }) => `- [${options[key] ? 'x' : ' '}] <!-- reviewflow-${key} -->${label}`).join('\n');
};

const toMarkdownInfos = infos => {
  return infos.map(info => {
    if (info.url) return `[${info.title}](${info.url})`;
    return info.title;
  }).join('\n');
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

const internalUpdateBodyOptionsAndInfos = (body, options, infos) => {
  const infosAndCommitNotesParagraph = body.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /^\s*(?:(#### Infos:.*)?(#### Commits Notes:.*)?#### Options:)?.*$/s, getReplacement(infos));
  return `${infosAndCommitNotesParagraph}#### Options:\n${toMarkdownOptions(options)}`;
};

const createCommentBody = (defaultOptions, infos) => {
  return internalUpdateBodyOptionsAndInfos('', defaultOptions, infos);
};
const updateCommentOptions = (commentBody, defaultOptions, optionsToUpdate) => {
  const options = parseOptions(commentBody, defaultOptions);
  const updatedOptions = updateOptions(options, optionsToUpdate);
  return {
    options: updatedOptions,
    commentBody: internalUpdateBodyOptionsAndInfos(commentBody, updatedOptions)
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

const getLabelsForRepo = async (context) => {
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
    }, 10_000);
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
    hasNeedsReview: labels => labels.some(label => needsReviewLabelIds.includes(label.id)),
    hasRequestedReview: labels => labels.some(label => requestedReviewLabelIds.includes(label.id)),
    hasChangesRequestedReview: labels => labels.some(label => changesRequestedLabelIds.includes(label.id)),
    hasApprovesReview: labels => labels.some(label => approvedReviewLabelIds.includes(label.id)),
    getNeedsReviewGroupNames: labels => labels.filter(label => needsReviewLabelIds.includes(label.id)).map(label => labelIdToGroupName.get(label.id)).filter(ExcludesFalsy),
    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: pr => {
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
    console.warn(`using default config for ${owner.login}`);
    accountConfig = config$1;
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
  if (owner.id === sendTo.id) return 'your PR';
  const isAssignedTo = pullRequest.assignees.some(a => a.id === sendTo.id);
  return `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ''}`;
};

async function createStatus(context, name, sha, type, description, url) {
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

  if (pullRequest.requested_reviewers.length > 0) {
    return createFailedStatusCheck(`Awaiting review from: ${pullRequest.requested_reviewers.map(rr => rr.login).join(', ')}`);
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
  const newLabelNames = new Set(prLabels.map(label => label.name));
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

      if (!label || prLabels.some(prLabel => prLabel.id === label.id)) {
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

      if (existing) {
        newLabelNames.delete(existing.name);
        toDelete.add(key);
        toDeleteNames.add(existing.name);
      }
    });
  } // TODO move that elsewhere


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
  }); // if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return;

  if (toAdd.size !== 0 || toDelete.size !== 0) {
    if (toDelete.size === 0 || toDelete.size < 4) {
      context.log.debug({
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        toAddNames: [...toAddNames],
        toDeleteNames: [...toDeleteNames]
      }, 'updateReviewStatus');

      if (toAdd.size !== 0) {
        const result = await context.octokit.issues.addLabels(context.issue({
          labels: [...toAddNames]
        }));
        prLabels = result.data;
      }

      if (toDelete.size !== 0) {
        for (const toDeleteName of [...toDeleteNames]) {
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
  await context.octokit.paginate(context.octokit.pulls.listReviews, context.pullRequest(), ({
    data: reviews
  }) => {
    reviews.forEach(review => {
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
      return !followers.find(f => f.id === rr.id) && !assigneeIds.includes(rr.id);
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
      return repoContext.slack.postMessage('pr-lifecycle', assignee.id, assignee.login, {
        text: createMessage(assignee)
      });
    });
    followers.map(follower => {
      if (context.payload.sender.id === follower.id) return;
      return repoContext.slack.postMessage('pr-lifecycle-follow', follower.id, follower.login, {
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
    if (userIds.has(c.user.id)) return;
    userIds.add(c.user.id);
    users.push({
      id: c.user.id,
      login: c.user.login
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
    const {
      comment
    } = context.payload;
    const type = comment.pull_request_review_id ? 'review-comment' : 'issue-comment';
    const body = comment.body;
    if (!body) return;
    const commentByOwner = pr.user.login === comment.user.login;
    const [discussion, {
      reviewers
    }] = await Promise.all([getDiscussion(context, comment), getReviewersAndReviewStates(context, repoContext)]);
    const followers = reviewers.filter(u => u.id !== pr.user.id && u.id !== comment.user.id);

    if (pr.requested_reviewers) {
      followers.push(...pr.requested_reviewers.filter(rr => {
        return !followers.find(f => f.id === rr.id) && rr.id !== comment.user.id && rr.id !== pr.user.id;
      }));
    }

    const usersInThread = getUsersInThread(discussion).filter(u => u.id !== pr.user.id && u.id !== comment.user.id && !followers.find(f => f.id === u.id));
    const mentions = getMentions(discussion).filter(m => m !== pr.user.login && m !== comment.user.login && !followers.find(f => f.login === m) && !usersInThread.find(u => u.login === m));
    const mention = repoContext.slack.mention(comment.user.login);
    const prUrl = createPrLink(pr, repoContext);
    const ownerMention = repoContext.slack.mention(pr.user.login);
    const commentLink = createLink(comment.html_url, comment.in_reply_to_id ? 'replied' : 'commented');

    const createMessage = toOwner => {
      const ownerPart = toOwner ? 'your PR' : `${pr.user.id === comment.user.id ? 'his' : `${ownerMention}'s`} PR`;
      return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
    };

    const promisesOwner = [];
    const promisesNotOwner = [];
    const slackifiedBody = slackifyCommentBody(comment.body, comment.start_line !== null);
    const isBotUser = checkIfUserIsBot(repoContext, comment.user);

    if (!commentByOwner) {
      const slackMessage = createSlackMessageWithSecondaryBlock(createMessage(true), slackifiedBody);
      promisesOwner.push(repoContext.slack.postMessage(isBotUser ? 'pr-comment-bots' : 'pr-comment', pr.user.id, pr.user.login, slackMessage).then(res => saveInDb(type, comment.id, repoContext.accountEmbed, [res], slackMessage)));
    }

    const message = createSlackMessageWithSecondaryBlock(createMessage(false), slackifiedBody);
    promisesNotOwner.push(...followers.map(follower => repoContext.slack.postMessage(isBotUser ? 'pr-comment-follow-bots' : 'pr-comment-follow', follower.id, follower.login, message)));
    promisesNotOwner.push(...usersInThread.map(user => repoContext.slack.postMessage('pr-comment-thread', user.id, user.login, message)));

    if (mentions.length > 0) {
      await appContext.mongoStores.users.findAll({
        login: {
          $in: mentions
        }
      }).then(users => {
        promisesNotOwner.push(...users.map(u => repoContext.slack.postMessage('pr-comment-mention', u._id, u.login, message)));
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
  } = updateCommentOptions(reviewflowPrContext.commentBody, repoContext.config.prDefaultOptions, updateOptions);
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
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const prHasFeatureBranchLabel = hasLabelInPR(pullRequest.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);
  return { ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel
  };
};
const syncLabelsAfterCommentBodyEdited = async (pullRequest, context, repoContext, reviewflowPrContext) => {
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const prHasFeatureBranchLabel = hasLabelInPR(pullRequest.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);
  const {
    commentBody,
    options
  } = updateCommentOptions(reviewflowPrContext.commentBody, calcDefaultOptions(repoContext, pullRequest));
  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options && (featureBranchLabel || automergeLabel)) {
    await Promise.all([featureBranchLabel && syncLabel(pullRequest, context, options.featureBranch, featureBranchLabel, prHasFeatureBranchLabel), skipCiLabel && syncLabel(pullRequest, context, options.autoMergeWithSkipCi, skipCiLabel, prHasSkipCiLabel), automergeLabel && syncLabel(pullRequest, context, options.autoMerge, automergeLabel, prHasAutoMergeLabel, {
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
      'account.id': repoContext.account._id,
      'account.type': repoContext.accountType,
      type,
      typeId: comment.id
    };
    const sentMessages = await appContext.mongoStores.slackSentMessages.findAll(criteria);
    if (sentMessages.length === 0) return;

    if (context.payload.action === 'deleted') {
      await Promise.all([Promise.all(sentMessages.map(sentMessage => Promise.all(sentMessage.sentTo.map(sentTo => repoContext.slack.deleteMessage(sentTo.ts, sentTo.channel))))), appContext.mongoStores.slackSentMessages.deleteMany(criteria)]);
    } else {
      const secondaryBlocks = [createMrkdwnSectionBlock(slackifyCommentBody(comment.body, comment.start_line !== null))];
      await Promise.all([Promise.all(sentMessages.map(sentMessage => Promise.all(sentMessage.sentTo.map(sentTo => repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, { ...sentMessage.message,
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
  const commits = await context.octokit.paginate(context.octokit.pulls.listCommits, context.pullRequest({
    // A custom page size up to 100. Default is 30.
    per_page: 100
  }), res => res.data);
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
  await Promise.all([syncLabel(pullRequest, context, breakingChangesCommits.length !== 0, breakingChangesLabel), updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newCommentBody)]); // TODO auto update ! in front of : to signal a breaking change when https://github.com/conventional-changelog/commitlint/issues/658 is closed
};

const cleanNewLines = text => text.replace(/\r\n/g, '\n');

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
  const title = repoContext.config.trimTitle ? cleanTitle(pullRequest.title) : pullRequest.title;
  const isPrFromBot = pullRequest.user.type === 'Bot';
  const statuses = [];
  const errorRule = repoContext.config.parsePR.title.find(rule => {
    if (rule.bot === false && isPrFromBot) return false;
    const match = rule.regExp.exec(title);

    if (match === null) {
      if (rule.status) {
        statuses.push({
          name: rule.status,
          error: rule.error
        });
      }

      return true;
    }

    if (rule.status && rule.statusInfoFromMatch) {
      statuses.push({
        name: rule.status,
        info: rule.statusInfoFromMatch(match)
      });
      return false;
    }

    return false;
  });
  const date = new Date().toISOString();
  const hasLintPrCheck = (await context.octokit.checks.listForRef(context.repo({
    ref: pullRequest.head.sha
  }))).data.check_runs.find(check => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`);
  const promises = [...statuses.map(({
    name,
    error,
    info
  }) => createStatus(context, name, pullRequest.head.sha, error ? 'failure' : 'success', error ? error.title : info.title, error ? undefined : info.url)), ...(previousSha ? statuses.map(({
    name,
    error,
    info
  }) => error ? createStatus(context, name, previousSha, 'success', 'New commits have been pushed') : undefined).filter(ExcludesFalsy) : []), hasLintPrCheck && context.octokit.checks.create(context.repo({
    name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
    head_sha: pullRequest.head.sha,
    status: 'completed',
    conclusion: errorRule ? 'failure' : 'success',
    started_at: date,
    completed_at: date,
    output: errorRule ? errorRule.error : {
      title: '✓ Your PR is valid',
      summary: ''
    }
  })), !hasLintPrCheck && previousSha && errorRule ? createStatus(context, 'lint-pr', previousSha, 'success', 'New commits have been pushed') : undefined, !hasLintPrCheck && createStatus(context, 'lint-pr', pullRequest.head.sha, errorRule ? 'failure' : 'success', errorRule ? errorRule.error.title : '✓ Your PR is valid')].filter(ExcludesFalsy);
  const body = removeDeprecatedReviewflowInPrBody(pullRequest.body);
  promises.push(updatePrIfNeeded(pullRequest, context, {
    title,
    body
  }));
  const commentBodyInfos = statuses.filter(status => {
    var _status$info;

    return (_status$info = status.info) === null || _status$info === void 0 ? void 0 : _status$info.inBody;
  }).map(status => status.info);
  const shouldCreateCommentBody = reviewflowPrContext.commentBody === defaultCommentBody;
  const newBody = shouldCreateCommentBody ? createCommentBody(calcDefaultOptions(repoContext, pullRequest), commentBodyInfos) : updateCommentBodyInfos(reviewflowPrContext.commentBody, commentBodyInfos);

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
      body: `@${login} could not update branch: base already contains the head, nothing to merge.`
    }));
  } else if (result.status === 409) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `@${login} could not update branch: merge conflict. Please resolve manually.`
    }));
  } else if (!result || !result.data || !result.data.sha) {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `@${login} could not update branch (unknown error)`
    }));
  } else {
    context.octokit.issues.createComment(context.repo({
      issue_number: pullRequest.number,
      body: `@${login} branch updated: ${result.data.sha}`
    }));
  }
};

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
            autoMergeWithSkipCi: hasLabelInPR(pullRequest.labels, codeApprovedLabel) ? true : repoContext.config.prDefaultOptions.autoMergeWithSkipCi
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
    const featureBranchLabel = repoContext.labels['feature-branch'];
    const automergeLabel = repoContext.labels['merge/automerge'];
    const skipCiLabel = repoContext.labels['merge/skip-ci'];

    const option = (() => {
      if (featureBranchLabel && label.id === featureBranchLabel.id) {
        return 'featureBranch';
      }

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
  if (pullRequest.assignees.length > 0) return;
  if (pullRequest.user.type === 'Bot') return;
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
  }, (pullRequest, context) => {
    return {
      reviewflowCommentPromise: createReviewflowComment(pullRequest.number, context, defaultCommentBody)
    };
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
      return repoContext.slack.postMessage('pr-lifecycle', assignee.id, assignee.login, {
        text: createMessage(assignee)
      });
    });
    followers.map(follower => {
      if (context.payload.sender.id === follower.id) return;
      return repoContext.slack.postMessage('pr-lifecycle-follow', follower.id, follower.login, {
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
          repoContext.slack.updateHome(assignee.login);
        });
      }

      if (!updatedPr.assignees.find(assignee => assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }
    }

    if (repoContext.slack) {
      if (sender.login === reviewer.login) {
        pullRequest.assignees.forEach(assignee => {
          repoContext.slack.postMessage('pr-review', assignee.id, assignee.login, {
            text: `:recycle: ${repoContext.slack.mention(reviewer.login)} dismissed his review on ${createPrLink(pullRequest, repoContext)}`
          });
        });
      } else {
        repoContext.slack.postMessage('pr-review', reviewer.id, reviewer.login, {
          text: `:recycle: ${repoContext.slack.mention(sender.login)} dismissed your review on ${createPrLink(pullRequest, repoContext)}`
        });
      }
    }
  }));
}

function reviewRequestRemoved(app, appContext) {
  app.on('pull_request.review_request_removed', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext) => {
    const sender = context.payload.sender;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

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

      if (pullRequest.assignees) {
        pullRequest.assignees.forEach(assignee => {
          repoContext.slack.updateHome(assignee.login);
        });
      }

      if (!pullRequest.assignees.find(assignee => assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }
    }

    if (sender.login === reviewer.login) return;
    repoContext.slack.postMessage('pr-review', reviewer.id, reviewer.login, {
      text: `:skull_and_crossbones: ${repoContext.slack.mention(sender.login)} removed the request for your review on ${createPrLink(pullRequest, repoContext)}`
    });
    const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne({
      'account.id': repoContext.account._id,
      'account.type': repoContext.accountType,
      type: 'review-requested',
      typeId: `${pullRequest.id}_${reviewer.id}`
    });

    if (sentMessageRequestedReview) {
      const sentTo = sentMessageRequestedReview.sentTo[0];
      const message = sentMessageRequestedReview.message;
      await Promise.all([repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, { ...message,
        text: message.text.split('\n').map(l => `~${l}~`).join('\n')
      }), repoContext.slack.addReaction(sentTo.ts, sentTo.channel, 'skull_and_crossbones'), appContext.mongoStores.slackSentMessages.deleteOne(sentMessageRequestedReview)]);
    }
  }));
}

function reviewRequested(app, appContext) {
  app.on('pull_request.review_requested', createPullRequestHandler(appContext, payload => payload.pull_request, async (pullRequest, context, repoContext) => {
    const sender = context.payload.sender;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });
    if (!repoContext.shouldIgnore && reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      await updateReviewStatus(pullRequest, context, repoContext, reviewerGroup, {
        add: ['needsReview', "requested"],
        remove: ['approved']
      });

      if (pullRequest.assignees) {
        pullRequest.assignees.forEach(assignee => {
          repoContext.slack.updateHome(assignee.login);
        });
      }

      if (!pullRequest.assignees.find(assignee => assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }
    }

    if (sender.login === reviewer.login) return;

    if (repoContext.slack) {
      const text = `:eyes: ${repoContext.slack.mention(sender.login)} requests your review on ${createPrLink(pullRequest, repoContext)} !\n> ${pullRequest.title}`;
      const message = {
        text
      };
      const result = await repoContext.slack.postMessage('pr-review', reviewer.id, reviewer.login, message);

      if (result) {
        await appContext.mongoStores.slackSentMessages.insertOne({
          type: 'review-requested',
          typeId: `${pullRequest.id}_${reviewer.id}`,
          message,
          account: repoContext.accountEmbed,
          sentTo: [result]
        });
      }
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

      if (!assignees.find(assignee => assignee.login === reviewer.login)) {
        repoContext.slack.updateHome(reviewer.login);
      }

      const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne({
        'account.id': repoContext.account._id,
        'account.type': repoContext.accountType,
        type: 'review-requested',
        typeId: `${pullRequest.id}_${reviewer.id}`
      });
      const emoji = getEmojiFromState(state);

      if (sentMessageRequestedReview) {
        const sentTo = sentMessageRequestedReview.sentTo[0];
        const message = sentMessageRequestedReview.message;
        await Promise.all([repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, { ...message,
          text: message.text.split('\n').map(l => `~${l}~`).join('\n')
        }), repoContext.slack.addReaction(sentTo.ts, sentTo.channel, emoji), appContext.mongoStores.slackSentMessages.deleteOne(sentMessageRequestedReview)]);
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
        repoContext.slack.postMessage('pr-review', assignee.id, assignee.login, createSlackMessageWithSecondaryBlock(createMessage(assignee.id === owner.id, true), slackifiedBody));
      });
      const message = createSlackMessageWithSecondaryBlock(createMessage(false), slackifiedBody);
      filteredFollowers.forEach(follower => {
        repoContext.slack.postMessage('pr-review-follow', follower.id, follower.login, message);
      });
    } else if (body) {
      const mention = repoContext.slack.mention(reviewer.login);
      const prUrl = createPrLink(pullRequest, repoContext);
      const commentLink = createLink(reviewUrl, 'commented');
      const message = createSlackMessageWithSecondaryBlock(`:speech_balloon: ${mention} ${commentLink} on his PR ${prUrl}`, body);
      filteredFollowers.forEach(follower => {
        repoContext.slack.postMessage('pr-review-follow', follower.id, follower.login, message);
      });
    }
  }));
}

const isSameBranch = (payload, lockedPr) => {
  if (!lockedPr) return false;
  return !!payload.branches.find(b => b.name === lockedPr.branch);
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
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(['organization.member_added', 'organization.member_removed'], createHandlerOrgChange(appContext, async (context, accountContext) => {
    await syncOrg(appContext.mongoStores, context.octokit, accountContext.account.installationId, context.payload.organization);
  }));
  /* https://developer.github.com/webhooks/event-payloads/#team */

  app.on(['team.created', 'team.deleted', 'team.edited'], createHandlerOrgChange(appContext, async context => {
    await syncTeams(appContext.mongoStores, context.octokit, context.payload.organization);
  }));
  /* https://developer.github.com/webhooks/event-payloads/#membership */

  app.on(['membership.added', 'membership.removed'], createHandlerOrgChange(appContext, async context => {
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
  })); // Repo

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
  }); // return { connection, prEvents };

  return {
    connection,
    userDmSettings,
    users,
    orgs,
    orgMembers,
    orgTeams,
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
    const blocks = [];

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
      }, ...results.items.map(pr => {
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
      }).flat(), {
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

    if (blocks.length === 0) {
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
    scheduleUpdateAllOrgs: async (auth) => {
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
if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow';
console.log({
  name: process.env.REVIEWFLOW_NAME
}); // const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');
// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));
// let config = await getConfig(context, 'reviewflow.yml');

probot.run(({
  app,
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
