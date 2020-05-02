'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

require('dotenv/config');
const probot = require('probot');
const liwiMongo = require('liwi-mongo');
const util = require('util');
const cookieParser = _interopDefault(require('cookie-parser'));
const jsonwebtoken = require('jsonwebtoken');
const React = _interopDefault(require('react'));
const server = require('react-dom/server');
const simpleOauth2 = require('simple-oauth2');
const crypto = require('crypto');
const lock = require('lock');
const webApi = require('@slack/web-api');
const parse = _interopDefault(require('@commitlint/parse'));

// import { MongoStore, MongoConnection, MongoModel } from 'liwi-mongo';
//   owner: string;
//   repo: string;
//   prId: string;
//   prNumber: string;
//   event: string;
// }

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
  // return { connection, prEvents };

  return {
    connection
  };
}

function Layout({
  lang = 'en',
  title = process.env.NAME,
  children
}) {
  return /*#__PURE__*/React.createElement("html", {
    lang: lang
  }, /*#__PURE__*/React.createElement("head", null, /*#__PURE__*/React.createElement("meta", {
    charSet: "UTF-8"
  }), /*#__PURE__*/React.createElement("meta", {
    name: "robots",
    content: "noindex"
  }), /*#__PURE__*/React.createElement("title", null, title), /*#__PURE__*/React.createElement("link", {
    rel: "stylesheet",
    type: "text/css",
    href: "https://christophe.hurpeau.com/index.css"
  }), /*#__PURE__*/React.createElement("style", null, `html,body,html body
            #container{height:100%} footer{position:absolute;bottom:5px;left:0;right:0;}`)), /*#__PURE__*/React.createElement("body", null, children));
}

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

const randomBytesPromisified = util.promisify(crypto.randomBytes);
async function randomHex(size) {
  const buffer = await randomBytesPromisified(size);
  return buffer.toString('hex');
}

/* eslint-disable max-lines */

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY;
const signPromisified = util.promisify(jsonwebtoken.sign);
const verifyPromisified = util.promisify(jsonwebtoken.verify);
const secure = !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== 'false';

const createRedirectUri = (req, strategy) => {
  const host = `http${secure ? 's' : ''}://${req.hostname}${req.hostname === 'localhost' ? `:${process.env.PORT}` : ''}`;
  return `${host}/app/${strategy}/login-response`;
};

const readAuthCookie = (req, strategy) => {
  const cookie = req.cookies[`auth_${strategy}`];
  if (!cookie) return;
  return verifyPromisified(cookie, AUTH_SECRET_KEY, {
    algorithm: 'HS512',
    audience: req.headers['user-agent']
  });
};

async function appRouter(app) {
  const router = app.route('/app');
  const api = await app.auth();
  router.use(cookieParser());
  router.get('/', (req, res) => {
    res.redirect('/app/gh');
  });
  router.get('/gh', async (req, res) => {
    const authInfo = await readAuthCookie(req, "gh");

    if (!authInfo) {
      return res.redirect('/app/gh/login');
    }

    const octokit = new probot.Octokit({
      auth: `token ${authInfo.accessToken}`
    });
    const {
      data
    } = await octokit.repos.list({
      per_page: 100
    });
    res.send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Your repositories"), /*#__PURE__*/React.createElement("ul", null, data.map(repo => /*#__PURE__*/React.createElement("li", {
      key: repo.id
    }, /*#__PURE__*/React.createElement("a", {
      href: `/app/gh/repository/${repo.owner.login}/${repo.name}`
    }, repo.name))))), data.length === 100 && /*#__PURE__*/React.createElement("div", null, "We currently have a limit to 100 repositories"))));
  });
  router.get('/gh/login', async (req, res) => {
    if (await readAuthCookie(req, "gh")) {
      return res.redirect('/app/gh');
    }

    const state = await randomHex(8);
    res.cookie(`auth_${"gh"}_${state}`, "gh", {
      maxAge: 600000,
      httpOnly: true,
      secure
    });
    const redirectUri = oauth2.authorizationCode.authorizeURL({
      redirect_uri: createRedirectUri(req, "gh"),
      scope: 'read:user,repo',
      state // grant_type: options.grantType,
      // access_type: options.accessType,
      // login_hint: req.query.loginHint,
      // include_granted_scopes: options.includeGrantedScopes,

    }); // console.log(redirectUri);

    res.redirect(redirectUri);
  });
  router.get('/gh/login-response', async (req, res) => {
    if (req.query.error) {
      res.send(req.query.error_description);
      return;
    }

    const code = req.query.code;
    const state = req.query.state;
    const cookieName = `auth_${"gh"}_${state}`;
    const cookie = req.cookies && req.cookies[cookieName];

    if (!cookie) {
      // res.redirect(`/${strategy}/login`);
      res.send('<html><body>No cookie for this state. <a href="/app/gh/login">Retry ?</a></body></html>');
      return;
    }

    res.clearCookie(cookieName);
    const result = await oauth2.authorizationCode.getToken({
      code,
      redirect_uri: createRedirectUri(req, "gh")
    });

    if (!result) {
      // res.redirect(`/${strategy}/login`);
      res.send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, "Could not get access token. ", /*#__PURE__*/React.createElement("a", {
        href: "/app/gh/login"
      }, "Retry ?")))));
      return;
    }

    const accessToken = result.access_token;
    const octokit = new probot.Octokit({
      auth: `token ${accessToken}`
    });
    const user = await octokit.users.getAuthenticated({});
    const login = user.data.login;
    const token = await signPromisified({
      login,
      accessToken,
      time: Date.now()
    }, AUTH_SECRET_KEY, {
      algorithm: 'HS512',
      audience: req.headers['user-agent'],
      expiresIn: '10 days'
    });
    res.cookie(`auth_${"gh"}`, token, {
      httpOnly: true,
      secure
    });
    res.redirect('/gh');
  });
  router.get('/gh/repository/:owner/:repository', async (req, res) => {
    const authInfo = await readAuthCookie(req, "gh");

    if (!authInfo) {
      return res.redirect('/gh/login');
    }

    const octokit = new probot.Octokit({
      auth: `token ${authInfo.accessToken}`
    });
    const {
      data
    } = await octokit.repos.get({
      owner: req.params.owner,
      repo: req.params.repository
    });

    if (!data) {
      return res.status(404).send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, "repo not found"))));
    }

    if (!data.permissions.admin) {
      return res.status(401).send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, "not authorized to see this repo, you need to have admin permission"))));
    }

    const {
      data: data2
    } = await api.apps.getRepoInstallation({
      owner: req.params.owner,
      repo: req.params.repository
    }).catch(err => {
      return {
        status: err.status,
        data: undefined
      };
    });

    if (!data2) {
      return res.send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, process.env.REVIEWFLOW_NAME, ' ', "isn't installed on this repo. Go to ", /*#__PURE__*/React.createElement("a", {
        href: `https://github.com/apps/${process.env.REVIEWFLOW_NAME}/installations/new`
      }, "Github Configuration"), ' ', "to add it."))));
    }

    res.send(server.renderToStaticMarkup( /*#__PURE__*/React.createElement(Layout, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, req.params.repository)))));
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

/* eslint-disable max-lines */
const config$1 = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  autoAssignToCreator: true,
  trimTitle: true,
  ignoreRepoPattern: '(infra-.*|devenv)',
  requiresReviewRequest: true,
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
        summary: 'https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional'
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
  groups: {
    dev: {
      /* ops */
      JulienBreux: `julien.breux${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Alan-pad': null,
      CamilSadiki: null,
      busser: null,

      /* back */
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Thierry-girod': `thierry${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      darame07: `kevin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Pixy: `pierre-alexis${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Radyum: `romain.reynaud${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* front */
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      vlbr: `valerian${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'budet-b': `benjamin.budet${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      mdcarter: `maxime.dehaye${process.env.ORNIKAR_EMAIL_DOMAIN}`
    },
    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Lenamari: `lena${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'AlexisRiols-Ornikar': `alexis.riols${process.env.ORNIKAR_EMAIL_DOMAIN}`
    }
  },
  teams: {
    ops: {
      logins: ['JulienBreux', 'Alan-pad', 'CamilSadiki', 'busser'],
      labels: ['teams/ops']
    },
    backends: {
      logins: ['abarreir', 'arthurflachs', 'damienorny', 'Thierry-girod', 'darame07', 'Pixy', 'Radyum'],
      labels: ['teams/backend']
    },
    frontends: {
      logins: ['christophehurpeau', 'HugoGarrido', 'LentnerStefan', 'CorentinAndre', 'Mxime', 'vlbr', 'budet-b', 'mdcarter'],
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

const config$2 = {
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
        summary: 'https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional'
      }
    }]
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
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
        name: ':soon: automerge',
        color: '#64DD17'
      },
      'merge/skip-ci': {
        name: 'automerge/skip-ci',
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

const orgsConfigs = {
  ornikar: config$1,
  christophehurpeau: config$2
};
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };

const options = ['featureBranch', 'autoMergeWithSkipCi', 'autoMerge', 'deleteAfterMerge'];
const optionsRegexps = options.map(option => ({
  name: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`)
}));
const optionsLabels = [{
  name: 'featureBranch',
  label: 'This PR is a feature branch'
}, {
  name: 'autoMergeWithSkipCi',
  label: 'Auto merge with `[skip ci]`'
}, {
  name: 'autoMerge',
  label: 'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)'
}, {
  name: 'deleteAfterMerge',
  label: 'Automatic branch delete after this PR is merged'
}];

const commentStart = '<!-- do not edit after this -->';
const commentEnd = "<!-- end - don't add anything after this -->";
const regexpCols = /^(.*)(<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->)(.*)$/is;
const regexpReviewflowCol = /^(\s*<!---? do not edit after this -?--><\/td><td [^>]*>)\s*(.*)\s*(<\/td><\/tr><\/table>\s*<!---? end - don't add anything after this -?-->)\s*$/is;

const parseOptions = (content, defaultConfig) => {
  return optionsRegexps.reduce((acc, {
    name,
    regexp
  }) => {
    const match = regexp.exec(content);
    acc[name] = !match ? defaultConfig[name] || false : match[1] === 'x' || match[1] === 'X';
    return acc;
  }, {});
};

const parseBody = description => {
  const match = regexpCols.exec(description);
  if (!match) return null;
  const [, content, reviewFlowCol, reviewflowContent, ending] = match;
  const reviewFlowColMatch = regexpReviewflowCol.exec(reviewFlowCol);

  if (!reviewFlowColMatch) {
    return {
      content,
      ending,
      reviewflowContentCol: reviewflowContent,
      reviewflowContentColPrefix: commentStart,
      reviewflowContentColSuffix: commentEnd
    };
  }

  const [, reviewflowContentColPrefix, reviewflowContentCol, reviewflowContentColSuffix] = reviewFlowColMatch;
  return {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix
  };
};
const parseBodyWithOptions = (description, defaultConfig) => {
  const parsedBody = parseBody(description);
  if (parsedBody === null) return null; // console.log(parsedBody.reviewflowContentCol);

  let breakingChanges = parsedBody.reviewflowContentCol.replace(/^.*#### Commits Notes:(.*)#### Options:.*$/s, '$1');

  if (breakingChanges === parsedBody.reviewflowContentCol) {
    breakingChanges = '';
  } else {
    breakingChanges = breakingChanges.trim();
  }

  return { ...parsedBody,
    options: parseOptions(parsedBody.reviewflowContentCol, defaultConfig),
    breakingChanges
  };
};

function hasLabelInPR(prLabels, label) {
  if (!label) return false;
  return prLabels.some(l => l.id === label.id);
}

/* eslint-disable max-lines */

const hasFailedStatusOrChecks = async (pr, context) => {
  const checks = await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));
  const failedChecks = checks.data.check_runs.filter(check => check.conclusion === 'failure');

  if (failedChecks.length !== 0) {
    context.log.info(`automerge not possible: failed check pr ${pr.id}`, {
      checks: failedChecks.map(check => check.name)
    });
    return true;
  }

  const combinedStatus = await context.github.repos.getCombinedStatusForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));

  if (combinedStatus.data.state === 'failure') {
    const failedStatuses = combinedStatus.data.statuses.filter(status => status.state === 'failure' || status.state === 'error');
    context.log.info(`automerge not possible: failed status pr ${pr.id}`, {
      statuses: failedStatuses.map(status => status.context)
    });
    return true;
  }

  return false;
};

const autoMergeIfPossible = async (pr, context, repoContext, prLabels = pr.labels) => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];

  if (!hasLabelInPR(prLabels, autoMergeLabel)) {
    context.log.debug('automerge not possible: no label', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return false;
  }

  const createMergeLockPrFromPr = () => ({
    id: pr.id,
    number: pr.number,
    branch: pr.head.ref
  });

  if (pr.state !== 'open') {
    context.log.debug('automerge not possible: pr is not opened', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
  }

  if (repoContext.hasNeedsReview(prLabels) || repoContext.hasRequestedReview(prLabels)) {
    context.log.debug('automerge not possible: blocking labels', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();

  if (lockedPr && lockedPr.number !== pr.number) {
    context.log.info('automerge not possible: locked pr', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pr.mergeable === undefined) {
    const prResult = await context.github.pulls.get(context.repo({
      pull_number: pr.number
    }));
    pr = prResult.data;
  }

  if (pr.merged) {
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info('automerge not possible: already merged pr', {
      prId: pr.id,
      prNumber: pr.number
    });
    return false;
  }

  context.log.info(`automerge?: ${pr.id}, #${pr.number}, mergeable=${pr.mergeable} state=${pr.mergeable_state}`); // https://github.com/octokit/octokit.net/issues/1763

  if (!(pr.mergeable_state === 'clean' || pr.mergeable_state === 'has_hooks' || pr.mergeable_state === 'unstable')) {
    if (!pr.mergeable_state || pr.mergeable_state === 'unknown') {
      context.log.info(`automerge not possible: rescheduling ${pr.id}`); // GitHub is determining whether the pull request is mergeable

      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (pr.head.ref.startsWith('renovate/')) {
      if (pr.mergeable_state === 'behind' || pr.mergeable_state === 'dirty') {
        context.log.info(`automerge not possible: rebase renovate branch pr ${pr.id}`); // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120

        if (pr.body.includes('<!-- renovate-rebase -->')) {
          if (pr.body.includes('[x] <!-- renovate-rebase -->')) {
            return false;
          }

          const renovateRebaseBody = pr.body.replace('[ ] <!-- renovate-rebase -->', '[x] <!-- renovate-rebase -->');
          await context.github.issues.update(context.repo({
            issue_number: pr.number,
            body: renovateRebaseBody
          }));
        } else if (!pr.title.startsWith('rebase!')) {
          await context.github.issues.update(context.repo({
            issue_number: pr.number,
            title: `rebase!${pr.title}`
          }));
        }

        return false;
      }

      if (await hasFailedStatusOrChecks(pr, context)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else if (pr.mergeable_state === 'blocked') {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }

      context.log.info(`automerge not possible: renovate with mergeable_state=${pr.mergeable_state}`);
      return false;
    }

    if (pr.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(pr, context)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }
    }

    if (pr.mergeable_state === 'behind') {
      context.log.info('automerge not possible: update branch', {
        head: pr.head.ref,
        base: pr.base.ref
      });
      await context.github.repos.merge({
        owner: pr.head.repo.owner.login,
        repo: pr.head.repo.name,
        head: pr.base.ref,
        base: pr.head.ref
      });
      return false;
    }

    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info(`automerge not possible: not mergeable mergeable_state=${pr.mergeable_state}`);
    return false;
  }

  try {
    context.log.info(`automerge pr #${pr.number}`);
    const parsedBody = parseBodyWithOptions(pr.body, repoContext.config.prDefaultOptions);
    const options = (parsedBody === null || parsedBody === void 0 ? void 0 : parsedBody.options) || repoContext.config.prDefaultOptions;
    const mergeResult = await context.github.pulls.merge({
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      pull_number: pr.number,
      commit_title: `${pr.title}${options.autoMergeWithSkipCi ? ' [skip ci]' : ''} (#${pr.number})`,
      commit_message: '' // TODO add BC

    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err.message);
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};

const getLabelsForRepo = async context => {
  const {
    data: labels
  } = await context.github.issues.listLabelsForRepo(context.repo({
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
      const result = await context.github.issues.createLabel(context.repo({
        name: labelConfig.name,
        color: labelColor,
        description
      }));
      finalLabels[labelKey] = result.data;
    } else if (existingLabel.name !== labelConfig.name || existingLabel.color !== labelColor || existingLabel.description !== description) {
      context.log.info('Needs to update label', {
        current_name: existingLabel.name,
        name: existingLabel.name !== labelConfig.name && labelConfig.name,
        color: existingLabel.color !== labelColor && labelColor,
        description: existingLabel.description !== description && description
      });
      const result = await context.github.issues.updateLabel(context.repo({
        current_name: existingLabel.name,
        name: labelConfig.name,
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

const getKeys = o => Object.keys(o);
const contextIssue = (context, object) => {
  const payload = context.payload;
  return context.repo({ ...object,
    issue_number: (payload.issue || payload.pull_request || payload).number
  });
};
const contextPr = (context, object) => {
  const payload = context.payload;
  return context.repo({ ...object,
    pull_number: (payload.issue || payload.pull_request || payload).number
  });
};

const ExcludesFalsy = Boolean;
const voidTeamSlack = () => ({
  mention: () => '',
  postMessage: () => Promise.resolve(),
  prLink: () => ''
});
const initTeamSlack = async (context, config) => {
  if (!config.slackToken) {
    return voidTeamSlack();
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});
  const slackClient = new webApi.WebClient(config.slackToken);
  const allUsers = await slackClient.users.list({
    limit: 200
  });
  const members = Object.values(githubLoginToSlackEmail).map(email => {
    const member = allUsers.members.find(user => user.profile.email === email);

    if (!member) {
      console.warn(`Could not find user ${email}`);
      return;
    }

    return [email, {
      member,
      im: undefined
    }];
  }).filter(ExcludesFalsy);

  for (const [, user] of members) {
    try {
      const im = await slackClient.im.open({
        user: user.member.id
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
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (githubLogin, text) => {
      context.log.debug('send slack', {
        githubLogin,
        text
      });
      if (process.env.DRY_RUN) return;
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return;
      await slackClient.chat.postMessage({
        username: process.env.REVIEWFLOW_NAME,
        channel: user.im.id,
        text
      });
    },
    prLink: (pr, context) => {
      return `<${pr.html_url}|${context.payload.repository.name}#${pr.number}>`;
    }
  };
};

const ExcludesFalsy$1 = Boolean;

const initTeamContext = async (context, config) => {
  const slackPromise = initTeamSlack(context, config);
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

  const getReviewerGroups = githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(Boolean))];

  return {
    config,
    getReviewerGroup: githubLogin => githubLoginToGroup.get(githubLogin),
    getReviewerGroups: githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(ExcludesFalsy$1))],
    getTeamsForLogin: githubLogin => githubLoginToTeams.get(githubLogin) || [],
    reviewShouldWait: (reviewerGroup, requestedReviewers, {
      includesReviewerGroup,
      includesWaitForGroups
    }) => {
      if (!reviewerGroup) return false;
      const requestedReviewerGroups = getReviewerGroups(requestedReviewers.map(request => request.login)); // contains another request of a reviewer in the same group

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

const orgContextsPromise = new Map();
const orgContexts = new Map();
const obtainOrgContext = (context, config) => {
  const owner = context.payload.repository.owner;
  const existingTeamContext = orgContexts.get(owner.login);
  if (existingTeamContext) return existingTeamContext;
  const existingPromise = orgContextsPromise.get(owner.login);
  if (existingPromise) return Promise.resolve(existingPromise);
  const promise = initTeamContext(context, config);
  orgContextsPromise.set(owner.login, promise);
  return promise.then(orgContext => {
    orgContextsPromise.delete(owner.login);
    orgContexts.set(owner.login, orgContext);
    return orgContext;
  });
};

/* eslint-disable max-lines */
const ExcludesFalsy$2 = Boolean;

async function initRepoContext(context, config) {
  const repo = context.payload.repository;
  const orgContext = await obtainOrgContext(context, config);
  const repoContext = Object.create(orgContext);
  const labels = await initRepoLabels(context, config);
  const reviewGroupNames = Object.keys(config.groups);
  const needsReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].needsReview).filter(Boolean).map(name => labels[name].id);
  const requestedReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].requested).filter(Boolean).map(name => labels[name].id);
  const changesRequestedLabelIds = reviewGroupNames.map(key => config.labels.review[key].changesRequested).filter(Boolean).map(name => labels[name].id);
  const approvedReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].approved).filter(Boolean).map(name => labels[name].id);
  const protectedLabelIds = [...requestedReviewLabelIds, ...changesRequestedLabelIds, ...approvedReviewLabelIds];
  const labelIdToGroupName = new Map();
  reviewGroupNames.forEach(key => {
    const reviewGroupLabels = config.labels.review[key];
    Object.keys(reviewGroupLabels).forEach(labelKey => {
      labelIdToGroupName.set(labels[reviewGroupLabels[labelKey]].id, key);
    });
  }); // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const lock$1 = lock.Lock();
  let lockMergePr;
  let automergeQueue = [];

  const lockPROrPRS = (prIdOrIds, prNumberOrPrNumbers, callback) => new Promise((resolve, reject) => {
    const logInfos = {
      repo: `${repo.owner.login}/${repo.name}`,
      prIdOrIds,
      prNumberOrPrNumbers
    };
    context.log.info('lock: try to lock pr', logInfos); // eslint-disable-next-line @typescript-eslint/no-misused-promises

    lock$1(prIdOrIds, async createReleaseCallback => {
      const release = createReleaseCallback(() => {});
      context.log.info('lock: lock acquired', logInfos);

      try {
        await callback();
      } catch (err) {
        context.log.info('lock: release pr (with error)', logInfos);
        release();
        reject(err);
        return;
      }

      context.log.info('lock: release pr', logInfos);
      release();
      resolve();
    });
  });

  const reschedule = (context, pr) => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info('reschedule', pr);
    setTimeout(() => {
      lockPROrPRS('reschedule', pr.number, () => {
        return lockPROrPRS(String(pr.id), pr.number, async () => {
          const prResult = await context.github.pulls.get(context.repo({
            pull_number: pr.number
          }));
          await autoMergeIfPossible(prResult.data, context, repoContext);
        });
      });
    }, 1000);
  };

  return Object.assign(repoContext, {
    labels,
    protectedLabelIds,
    hasNeedsReview: labels => labels.some(label => needsReviewLabelIds.includes(label.id)),
    hasRequestedReview: labels => labels.some(label => requestedReviewLabelIds.includes(label.id)),
    hasChangesRequestedReview: labels => labels.some(label => changesRequestedLabelIds.includes(label.id)),
    hasApprovesReview: labels => labels.some(label => approvedReviewLabelIds.includes(label.id)),
    getNeedsReviewGroupNames: labels => labels.filter(label => needsReviewLabelIds.includes(label.id)).map(label => labelIdToGroupName.get(label.id)).filter(ExcludesFalsy$2),
    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: pr => {
      console.log('merge lock: lock', {
        repo: `${repo.owner.login}/${repo.name}`,
        pr
      });

      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }

      if (lockMergePr) throw new Error('Already have lock');
      lockMergePr = pr;
    },
    removePrFromAutomergeQueue: (context, prNumber) => {
      context.log('merge lock: remove', {
        repo: `${repo.owner.login}/${repo.name}`,
        prNumber
      });

      if (lockMergePr && String(lockMergePr.number) === String(prNumber)) {
        lockMergePr = automergeQueue.shift();
        context.log('merge lock: next', {
          repo: `${repo.owner.login}/${repo.name}`,
          lockMergePr
        });

        if (lockMergePr) {
          reschedule(context, lockMergePr);
        }
      } else {
        automergeQueue = automergeQueue.filter(value => String(value.number) !== String(prNumber));
      }
    },
    pushAutomergeQueue: pr => {
      console.log('merge lock: push queue', {
        repo: `${repo.owner.login}/${repo.name}`,
        pr,
        lockMergePr,
        automergeQueue
      });

      if (!automergeQueue.some(p => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
    },
    reschedule,
    lockPROrPRS
  });
}

const repoContextsPromise = new Map();
const repoContexts = new Map();
const shouldIgnoreRepo = (repoName, orgConfig) => {
  const ignoreRepoRegexp = orgConfig.ignoreRepoPattern && new RegExp(`^${orgConfig.ignoreRepoPattern}$`);

  if (repoName === 'reviewflow-test') {
    return process.env.REVIEWFLOW_NAME !== 'reviewflow-test';
  }

  if (ignoreRepoRegexp) {
    return ignoreRepoRegexp.test(repoName);
  }

  return false;
};
const obtainRepoContext = context => {
  const repo = context.payload.repository;
  const owner = repo.owner;
  const key = repo.id;
  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;
  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);
  let orgConfig = orgsConfigs[owner.login];

  if (!orgConfig) {
    console.warn(`using default config for ${owner.login}`);
    orgConfig = config;
  }

  if (shouldIgnoreRepo(repo.name, orgConfig)) {
    console.warn('repo ignored', {
      owner: repo.owner.login,
      name: repo.name
    });
    return null;
  }

  const promise = initRepoContext(context, orgConfig);
  repoContextsPromise.set(key, promise);
  return promise.then(repoContext => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};

const handlerPullRequestChange = async (context, callback) => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;
  return repoContext.lockPROrPRS(String(context.payload.pull_request.id), context.payload.pull_request.number, async () => {
    const prResult = await context.github.pulls.get(context.repo({
      pull_number: context.payload.pull_request.number
    }));
    await callback(prResult.data, repoContext);
  });
};
const createHandlerPullRequestChange = callback => context => {
  return handlerPullRequestChange(context, (pr, repoContext) => callback(pr, context, repoContext));
};
const createHandlerPullRequestsChange = (getPullRequests, callback) => async context => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;
  const prs = getPullRequests(context, repoContext);
  if (prs.length === 0) return;
  return repoContext.lockPROrPRS(prs.map(pr => String(pr.id)), prs.map(pr => pr.number), () => callback(context, repoContext));
};

const autoAssignPRToCreator = async (pr, context, repoContext) => {
  if (!repoContext.config.autoAssignToCreator) return;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;
  await context.github.issues.addAssignees(contextIssue(context, {
    assignees: [pr.user.login]
  }));
};

const cleanTitle = title => title.trim().replace(/[\s-]+\[?\s*([A-Za-z][\dA-Za-z]+)[ -](\d+)\s*]?\s*$/, (s, arg1, arg2) => ` ${arg1.toUpperCase()}-${arg2}`).replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `).replace(/^Revert "([^"]+)"$/, 'revert: $1').replace(/\s+[[\]]\s*no\s*issue\s*[[\]]$/i, ' [no issue]') // eslint-disable-next-line unicorn/no-unsafe-regex
.replace(/^(revert:.*)(\s+\(#\d+\))$/, '$1');

const toMarkdownOptions = options => {
  return optionsLabels.map(({
    name,
    label
  }) => `- [${options[name] ? 'x' : ' '}] <!-- reviewflow-${name} -->${label}`).join('\n');
};

const toMarkdownInfos = infos => {
  return infos.map(info => {
    if (info.url) return `[${info.title}](${info.url})`;
    return info.title;
  }).join('\n');
};

const getReplacement = infos => {
  if (!infos) return '$1$2';
  return infos.length !== 0 ? `#### Infos:\n${toMarkdownInfos(infos)}\n$2` : '$2';
};

const updateBody = (body, defaultConfig, infos, updateOptions) => {
  const parsed = parseBodyWithOptions(body, defaultConfig);

  if (!parsed) {
    console.info('could not parse body');
    return {
      body
    };
  }

  const {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options
  } = parsed;
  const infosAndCommitNotesParagraph = reviewflowContentCol.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /^\s*(?:(#### Infos:.*)?(#### Commits Notes:.*)?#### Options:)?.*$/s, getReplacement(infos));
  const updatedOptions = !updateOptions ? options : { ...options,
    ...updateOptions
  };
  return {
    options: updatedOptions,
    body: `${content}${reviewflowContentColPrefix}
${infosAndCommitNotesParagraph}#### Options:
${toMarkdownOptions(updatedOptions)}
${reviewflowContentColSuffix}${ending || ''}`
  };
};
const updateBodyCommitsNotes = (body, commitNotes) => {
  const parsed = parseBody(body);

  if (!parsed) {
    console.info('could not parse body');
    return body;
  }

  const {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix
  } = parsed;
  const reviewflowContentColReplaced = reviewflowContentCol.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /(?:#### Commits Notes:.*)?(#### Options:)/s, // eslint-disable-next-line no-nested-ternary
  !commitNotes ? '$1' : `#### Commits Notes:\n\n${commitNotes}\n\n$1`);
  return `${content}${reviewflowContentColPrefix}${reviewflowContentColReplaced}${reviewflowContentColSuffix}${ending || ''}`;
};

const updatePrIfNeeded = async (pr, context, repoContext, update) => {
  const hasDiffInTitle = update.title && pr.title !== update.title;
  const hasDiffInBody = update.body && pr.body !== update.body;

  if (hasDiffInTitle || hasDiffInBody) {
    const diff = {};

    if (hasDiffInTitle) {
      diff.title = update.title;
      pr.title = update.title;
    }

    if (hasDiffInBody) {
      diff.body = update.body;
      pr.body = update.body;
    }

    await context.github.issues.update(contextIssue(context, diff));
  }
};

async function syncLabel(pr, context, shouldHaveLabel, label, prHasLabel = hasLabelInPR(pr.labels, label), {
  onRemove,
  onAdd
} = {}) {
  if (prHasLabel && !shouldHaveLabel) {
    await context.github.issues.removeLabel(contextIssue(context, {
      name: label.name
    }));
    if (onRemove) await onRemove();
  }

  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.github.issues.addLabels(contextIssue(context, {
      labels: [label.name]
    }));
    if (onAdd) await onAdd(response.data);
  }
}

async function createStatus(context, name, sha, type, description, url) {
  await context.github.repos.createStatus(context.repo({
    context: name === '' ? process.env.REVIEWFLOW_NAME : `${process.env.REVIEWFLOW_NAME}/${name}`,
    sha,
    state: type,
    description,
    target_url: url
  }));
}

/* eslint-disable max-lines */
const ExcludesFalsy$3 = Boolean;
const editOpenedPR = async (pr, context, repoContext, previousSha) => {
  const repo = context.payload.repository; // do not lint pr from forks

  if (pr.head.repo.id !== repo.id) return {
    skipAutoMerge: true
  };
  const title = repoContext.config.trimTitle ? cleanTitle(pr.title) : pr.title;
  const isPrFromBot = pr.user.type === 'Bot';
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
  const hasLintPrCheck = (await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha
  }))).data.check_runs.find(check => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`);
  await Promise.all([...statuses.map(({
    name,
    error,
    info
  }) => createStatus(context, name, pr.head.sha, error ? 'failure' : 'success', error ? error.title : info.title, error ? undefined : info.url)), ...(previousSha ? statuses.map(({
    name,
    error,
    info
  }) => error ? createStatus(context, name, previousSha, 'success', 'New commits have been pushed') : undefined).filter(ExcludesFalsy$3) : []), hasLintPrCheck && context.github.checks.create(context.repo({
    name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
    head_sha: pr.head.sha,
    status: 'completed',
    conclusion: errorRule ? 'failure' : 'success',
    started_at: date,
    completed_at: date,
    output: errorRule ? errorRule.error : {
      title: '✓ Your PR is valid',
      summary: ''
    }
  })), !hasLintPrCheck && previousSha && errorRule ? createStatus(context, 'lint-pr', previousSha, 'success', 'New commits have been pushed') : undefined, !hasLintPrCheck && createStatus(context, 'lint-pr', pr.head.sha, errorRule ? 'failure' : 'success', errorRule ? errorRule.error.title : '✓ Your PR is valid')].filter(ExcludesFalsy$3));
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const prHasFeatureBranchLabel = hasLabelInPR(pr.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pr.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pr.labels, automergeLabel);
  const defaultOptions = { ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel
  };
  const {
    body,
    options
  } = updateBody(pr.body, defaultOptions, statuses.filter(status => status.info && status.info.inBody).map(status => status.info));
  await updatePrIfNeeded(pr, context, repoContext, {
    title,
    body
  });

  if (options && (featureBranchLabel || automergeLabel)) {
    await Promise.all([featureBranchLabel && syncLabel(pr, context, options.featureBranch, featureBranchLabel, prHasFeatureBranchLabel), skipCiLabel && syncLabel(pr, context, options.autoMergeWithSkipCi, skipCiLabel, prHasSkipCiLabel), automergeLabel && syncLabel(pr, context, options.autoMerge, automergeLabel, prHasAutoMergeLabel, {
      onAdd: async prLabels => {
        await autoMergeIfPossible(pr, context, repoContext, prLabels);
      },
      onRemove: () => {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
      }
    })]);

    if (!automergeLabel) {
      return {
        skipAutoMerge: true
      };
    }
  }

  return {
    skipAutoMerge: false
  };
};

const addStatusCheck = async function (pr, context, {
  state,
  description
}, previousSha) {
  const hasPrCheck = (await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha
  }))).data.check_runs.find(check => check.name === process.env.REVIEWFLOW_NAME);
  context.log.info('add status check', {
    hasPrCheck,
    state,
    description
  });

  if (hasPrCheck) {
    await context.github.checks.create(context.repo({
      name: process.env.REVIEWFLOW_NAME,
      head_sha: pr.head.sha,
      started_at: pr.created_at,
      status: 'completed',
      conclusion: state,
      completed_at: new Date().toISOString(),
      output: {
        title: description,
        summary: ''
      }
    }));
  } else if (previousSha && state === 'failure') {
    await Promise.all([createStatus(context, '', previousSha, 'success', 'New commits have been pushed'), createStatus(context, '', pr.head.sha, state, description)]);
  } else {
    await createStatus(context, '', pr.head.sha, state, description);
  }
};

const updateStatusCheckFromLabels = (pr, context, repoContext, labels = pr.labels || [], previousSha) => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map(l => l === null || l === void 0 ? void 0 : l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels)
  });

  const createFailedStatusCheck = description => addStatusCheck(pr, context, {
    state: 'failure',
    description
  }, previousSha);

  if (pr.requested_reviewers.length !== 0) {
    return createFailedStatusCheck(`Awaiting review from: ${pr.requested_reviewers.map(rr => rr.login).join(', ')}`);
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck('Changes requested ! Push commits or discuss changes then re-request a review.');
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length !== 0) {
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


  return addStatusCheck(pr, context, {
    state: 'success',
    description: '✓ PR ready to merge !'
  }, previousSha); // }
};

const updateReviewStatus = async (pr, context, repoContext, reviewGroup, {
  add: labelsToAdd,
  remove: labelsToRemove
}) => {
  context.log.info('updateReviewStatus', {
    reviewGroup,
    labelsToAdd,
    labelsToRemove
  });
  let prLabels = pr.labels || [];
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


  repoContext.getTeamsForLogin(pr.user.login).forEach(teamName => {
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
  }); // if (process.env.DRY_RUN) return;

  if (toAdd.size !== 0 || toDelete.size !== 0) {
    if (toDelete.size === 0 || toDelete.size < 4) {
      context.log.info('updateReviewStatus', {
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        toAddNames: [...toAddNames],
        toDeleteNames: [...toDeleteNames]
      });

      if (toAdd.size !== 0) {
        const result = await context.github.issues.addLabels(contextIssue(context, {
          labels: [...toAddNames]
        }));
        prLabels = result.data;
      }

      if (toDelete.size !== 0) {
        for (const toDeleteName of [...toDeleteNames]) {
          try {
            const result = await context.github.issues.removeLabel(contextIssue(context, {
              name: toDeleteName
            }));
            prLabels = result.data;
          } catch (err) {
            context.log.warn('error removing label', {
              err: err === null || err === void 0 ? void 0 : err.message
            });
          }
        }
      }
    } else {
      const newLabelNamesArray = [...newLabelNames];
      context.log.info('updateReviewStatus', {
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        oldLabels: prLabels.map(l => l.name),
        newLabelNames: newLabelNamesArray
      });
      const result = await context.github.issues.replaceLabels(contextIssue(context, {
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


  await updateStatusCheckFromLabels(pr, context, repoContext, prLabels); // }

  return prLabels;
};

const autoApproveAndAutoMerge = async (pr, context, repoContext) => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];

  if (hasLabelInPR(pr.labels, codeApprovedLabel)) {
    await context.github.pulls.createReview(contextPr(context, {
      event: 'APPROVE'
    }));
    await autoMergeIfPossible(pr, context, repoContext);
    return true;
  }

  return false;
};

const readCommitsAndUpdateInfos = async (pr, context, repoContext) => {
  // tmp.data[0].sha
  // tmp.data[0].commit.message
  const commits = await context.github.paginate(context.github.pulls.listCommits.endpoint.merge(contextPr(context, {
    // A custom page size up to 100. Default is 30.
    per_page: 100
  })), res => res.data);
  const conventionalCommits = await Promise.all(commits.map(c => parse(c.commit.message)));
  const breakingChangesCommits = conventionalCommits.reduce((acc, c, index) => {
    const breakingChangesNotes = c.notes.filter(note => note.title === 'BREAKING CHANGE');

    if (breakingChangesNotes.length !== 0) {
      acc.push({
        commit: commits[index],
        breakingChangesNotes
      });
    }

    return acc;
  }, []);
  const breakingChangesLabel = repoContext.labels['breaking-changes'];
  const newBody = updateBodyCommitsNotes(pr.body, breakingChangesCommits.length === 0 ? '' : `Breaking Changes:\n${breakingChangesCommits.map(({
    commit,
    breakingChangesNotes
  }) => breakingChangesNotes.map(note => `- ${note.text.replace('\n', ' ')} (${commit.sha})`)).join('')}`);
  await Promise.all([syncLabel(pr, context, breakingChangesCommits.length !== 0, breakingChangesLabel), updatePrIfNeeded(pr, context, repoContext, {
    body: newBody
  })]); // TODO auto update ! in front of : to signal a breaking change when https://github.com/conventional-changelog/commitlint/issues/658 is closed
};

function opened(app) {
  app.on('pull_request.opened', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const fromRenovate = pr.head.ref.startsWith('renovate/');
    await Promise.all([autoAssignPRToCreator(pr, context, repoContext), editOpenedPR(pr, context, repoContext).then(() => {
      return readCommitsAndUpdateInfos(pr, context, repoContext);
    }), fromRenovate ? autoApproveAndAutoMerge(pr, context, repoContext).then(async approved => {
      if (!approved) {
        await updateReviewStatus(pr, context, repoContext, 'dev', {
          add: ['needsReview']
        });
      }
    }) : updateReviewStatus(pr, context, repoContext, 'dev', {
      add: ['needsReview'],
      remove: ['approved', 'changesRequested']
    })]);
  }));
}

function closed(app) {
  app.on('pull_request.closed', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const repo = context.payload.repository;

    if (pr.merged) {
      const parsedBody = pr.head.repo.id === repo.id ? parseBodyWithOptions(pr.body, repoContext.config.prDefaultOptions) : null;
      await Promise.all([repoContext.removePrFromAutomergeQueue(context, pr.number), (parsedBody === null || parsedBody === void 0 ? void 0 : parsedBody.options.deleteAfterMerge) ? context.github.git.deleteRef(context.repo({
        ref: `heads/${pr.head.ref}`
      })).catch(() => {}) : undefined]);
    } else {
      await Promise.all([repoContext.removePrFromAutomergeQueue(context, pr.number), updateReviewStatus(pr, context, repoContext, 'dev', {
        remove: ['needsReview']
      })]);
    }
  }));
}

function closed$1(app) {
  app.on('pull_request.reopened', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    await Promise.all([updateReviewStatus(pr, context, repoContext, 'dev', {
      add: ['needsReview'],
      remove: ['approved']
    }), readCommitsAndUpdateInfos(pr, context, repoContext)]);
  }));
}

function reviewRequested(app) {
  app.on('pull_request.review_requested', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const sender = context.payload.sender; // ignore if sender is self (dismissed review rerequest review)

    if (sender.type === 'Bot') return;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    // repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });
    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const {
        data: reviews
      } = await context.github.pulls.listReviews(contextPr(context, {
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES' && // In case this is a rerequest for review
      review.user.login !== reviewer.login);

      if (!hasChangesRequestedInReviews) {
        await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
          add: ['needsReview', "requested"],
          remove: ['approved', 'changesRequested']
        });
      }
    }

    if (sender.login === reviewer.login) return;

    if (repoContext.slack) {
      repoContext.slack.postMessage(reviewer.login, `:eyes: ${repoContext.slack.mention(sender.login)} requests your review on ${repoContext.slack.prLink(pr, context)} !\n> ${pr.title}`);
    }
  }));
}

function reviewRequestRemoved(app) {
  app.on('pull_request.review_request_removed', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const sender = context.payload.sender;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, {
        includesReviewerGroup: true
      });
      const {
        data: reviews
      } = await context.github.pulls.listReviews(contextPr(context, {
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      const hasApprovedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'APPROVED');
      const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && hasApprovedInReviews;
      await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
        add: [// if changes requested by the one which requests was removed
        hasChangesRequestedInReviews && 'changesRequested', // if was already approved by another member in the group and has no other requests waiting
        approved && 'approved'],
        // remove labels if has no other requests waiting
        remove: [approved && 'needsReview', !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && 'requested']
      });
    }

    if (sender.login === reviewer.login) return;

    if (repoContext.slack) {
      repoContext.slack.postMessage(reviewer.login, `:skull_and_crossbones: ${repoContext.slack.mention(sender.login)} removed the request for your review on ${repoContext.slack.prLink(pr, context)}`);
    }
  }));
}

function reviewSubmitted(app) {
  app.on('pull_request_review.submitted', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const {
      user: reviewer,
      state
    } = context.payload.review;
    if (pr.user.login === reviewer.login) return;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
    let merged;

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, {
        includesReviewerGroup: true // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
        // includesWaitForGroups: true,

      });
      const {
        data: reviews
      } = await context.github.pulls.listReviews(contextPr(context, {
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && state === 'approved';
      const newLabels = await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
        add: [approved && 'approved', state === 'changes_requested' && 'changesRequested'],
        remove: [approved && 'needsReview', !(hasRequestedReviewsForGroup || state === 'changes_requested') && 'requested', state === 'approved' && !hasChangesRequestedInReviews && 'changesRequested', state === 'changes_requested' && 'approved']
      });

      if (approved && !hasChangesRequestedInReviews) {
        merged = await autoMergeIfPossible(pr, context, repoContext, newLabels);
      }
    }

    const mention = repoContext.slack.mention(reviewer.login);
    const prUrl = repoContext.slack.prLink(pr, context);

    const message = (() => {
      if (state === 'changes_requested') {
        return `:x: ${mention} requests changes on ${prUrl}`;
      }

      if (state === 'approved') {
        return `:clap: :white_check_mark: ${mention} approves ${prUrl}${merged ? ' and PR is merged :tada:' : ''}`;
      }

      return `:speech_balloon: ${mention} commented on ${prUrl}`;
    })();

    repoContext.slack.postMessage(pr.user.login, message);
  }));
}

function reviewDismissed(app) {
  app.on('pull_request_review.dismissed', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const sender = context.payload.sender;
    const reviewer = context.payload.review.user;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const {
        data: reviews
      } = await context.github.pulls.listReviews(contextPr(context, {
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
        add: ['needsReview', 'requested'],
        remove: [!hasChangesRequestedInReviews && 'changesRequested', 'approved']
      });
    }

    if (repoContext.slack) {
      if (sender.login === reviewer.login) {
        repoContext.slack.postMessage(pr.user.login, `:skull: ${repoContext.slack.mention(reviewer.login)} dismissed his review on ${repoContext.slack.prLink(pr, context)}`);
      } else {
        repoContext.slack.postMessage(reviewer.login, `:skull: ${repoContext.slack.mention(sender.login)} dismissed your review on ${repoContext.slack.prLink(pr, context)}`);
      }
    }
  }));
}

function synchronize(app) {
  app.on('pull_request.synchronize', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    // old and new sha
    // const { before, after } = context.payload;
    const previousSha = context.payload.before;
    await Promise.all([editOpenedPR(pr, context, repoContext, previousSha), // addStatusCheckToLatestCommit
    updateStatusCheckFromLabels(pr, context, repoContext, pr.labels, previousSha), readCommitsAndUpdateInfos(pr, context, repoContext)]); // call autoMergeIfPossible to re-add to the queue when push is fixed

    await autoMergeIfPossible(pr, context, repoContext);
  }));
}

function edited(app) {
  app.on('pull_request.edited', createHandlerPullRequestChange(async (pr, context, repoContext) => {
    const sender = context.payload.sender;

    if (sender.type === 'Bot' && sender.login === `${process.env.REVIEWFLOW_NAME}[bot]`) {
      return;
    }

    const {
      skipAutoMerge
    } = await editOpenedPR(pr, context, repoContext);
    if (!skipAutoMerge) await autoMergeIfPossible(pr, context, repoContext);
  }));
}

const updatePrBody = async (pr, context, repoContext, updateOptions) => {
  const {
    body
  } = updateBody(pr.body, repoContext.config.prDefaultOptions, undefined, updateOptions);
  await updatePrIfNeeded(pr, context, repoContext, {
    body
  });
};

function labelsChanged(app) {
  app.on(['pull_request.labeled', 'pull_request.unlabeled'], async context => {
    const sender = context.payload.sender;
    const fromRenovate = sender.type === 'Bot' && sender.login === 'renovate[bot]';
    context.payload.pull_request.head.ref.startsWith('renovate/');

    if (sender.type === 'Bot' && !fromRenovate) {
      return;
    }

    await handlerPullRequestChange(context, async (pr, repoContext) => {
      const label = context.payload.label;

      if (fromRenovate) {
        const codeApprovedLabel = repoContext.labels['code/approved'];
        const autoMergeLabel = repoContext.labels['merge/automerge'];
        const autoMergeSkipCiLabel = repoContext.labels['merge/skip-ci'];

        if (context.payload.action === 'labeled') {
          if (codeApprovedLabel && label.id === codeApprovedLabel.id) {
            // const { data: reviews } = await context.github.pulls.listReviews(
            //   contextPr(context, { per_page: 1 }),
            // );
            // if (reviews.length !== 0) {
            await context.github.pulls.createReview(contextPr(context, {
              event: 'APPROVE'
            }));

            if (autoMergeSkipCiLabel) {
              await context.github.issues.addLabels(contextIssue(context, {
                labels: [autoMergeSkipCiLabel.name]
              }));
            }

            await updateStatusCheckFromLabels(pr, context, repoContext);
            await updatePrBody(pr, context, repoContext, {
              autoMergeWithSkipCi: true,
              // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
              autoMerge: hasLabelInPR(pr.labels, autoMergeLabel) ? true : repoContext.config.prDefaultOptions.autoMerge
            }); // }
          } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
            await updatePrBody(pr, context, repoContext, {
              autoMerge: true,
              // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
              // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
              autoMergeWithSkipCi: hasLabelInPR(pr.labels, codeApprovedLabel) ? true : repoContext.config.prDefaultOptions.autoMergeWithSkipCi
            });
          }

          await autoMergeIfPossible(pr, context, repoContext);
        }

        return;
      }

      if (repoContext.protectedLabelIds.includes(label.id)) {
        if (context.payload.action === 'labeled') {
          await context.github.issues.removeLabel(contextIssue(context, {
            name: label.name
          }));
        } else {
          await context.github.issues.addLabels(contextIssue(context, {
            labels: [label.name]
          }));
        }

        return;
      }

      await updateStatusCheckFromLabels(pr, context, repoContext);
      const featureBranchLabel = repoContext.labels['feature-branch'];
      const automergeLabel = repoContext.labels['merge/automerge'];
      const skipCiLabel = repoContext.labels['merge/skip-ci'];

      const option = (() => {
        if (featureBranchLabel && label.id === featureBranchLabel.id) return 'featureBranch';
        if (automergeLabel && label.id === automergeLabel.id) return 'autoMerge';
        if (skipCiLabel && label.id === skipCiLabel.id) return 'autoMergeWithSkipCi';
        return null;
      })();

      if (option) {
        await updatePrBody(pr, context, repoContext, {
          [option]: context.payload.action === 'labeled'
        });
      } else if (context.payload.action === 'labeled') {
        if (repoContext.labels['merge/automerge'] && label.id === repoContext.labels['merge/automerge'].id) {
          await autoMergeIfPossible(pr, context, repoContext);
        }
      }
    });
  });
}

function checkrunCompleted(app) {
  app.on('check_run.completed', createHandlerPullRequestsChange(context => context.payload.check_run.pull_requests, async (context, repoContext) => {
    await Promise.all(context.payload.check_run.pull_requests.map(pr => context.github.pulls.get(context.repo({
      pull_number: pr.number
    })).then(prResult => {
      return autoMergeIfPossible(prResult.data, context, repoContext);
    })));
  }));
}

function checksuiteCompleted(app) {
  app.on('check_suite.completed', createHandlerPullRequestsChange(context => context.payload.check_suite.pull_requests, async (context, repoContext) => {
    await Promise.all(context.payload.check_suite.pull_requests.map(pr => context.github.pulls.get(context.repo({
      pull_number: pr.number
    })).then(prResult => {
      return autoMergeIfPossible(prResult.data, context, repoContext);
    })));
  }));
}

const isSameBranch = (context, lockedPr) => {
  if (!lockedPr) return false;
  return !!context.payload.branches.find(b => b.name === lockedPr.branch);
};

function status(app) {
  app.on('status', createHandlerPullRequestsChange((context, repoContext) => {
    const lockedPr = repoContext.getMergeLockedPr();
    if (!lockedPr) return [];

    if (context.payload.state !== 'loading' && isSameBranch(context, lockedPr)) {
      return [lockedPr];
    }

    return [];
  }, (context, repoContext) => {
    const lockedPr = repoContext.getMergeLockedPr(); // check if changed

    if (isSameBranch(context, lockedPr)) {
      repoContext.reschedule(context, lockedPr);
    }
  }));
}

function initApp(app) {
  opened(app);
  closed(app);
  closed$1(app);
  reviewRequested(app);
  reviewRequestRemoved(app); // app.on('pull_request.closed', async context => {
  // });
  // app.on('pull_request.reopened', async context => {
  // });

  reviewSubmitted(app);
  reviewDismissed(app);
  labelsChanged(app);
  synchronize(app);
  edited(app);
  checkrunCompleted(app);
  checksuiteCompleted(app);
  status(app);
}

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow';
console.log({
  name: process.env.REVIEWFLOW_NAME
}); // const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');
// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));
// let config = await getConfig(context, 'reviewflow.yml');
// eslint-disable-next-line import/no-commonjs

probot.Probot.run(app => {
  const mongoStores = init();
  appRouter(app);
  initApp(app);
});
//# sourceMappingURL=index-node10.cjs.js.map
