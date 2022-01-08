// An express application adding both the parse-server module & parse-dashboard
// to expose Parse compatible API routes.

const dotenv = require('dotenv');
const express = require('express');
// eslint-disable-next-line no-unused-vars
const helmet = require('helmet');
const xss = require('xss-clean');
// eslint-disable-next-line no-unused-vars
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const httpStatus = require('http-status');
const createError = require('http-errors');
const ParseServer = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const { ApiPayloadConverter } = require('parse-server-api-mail-adapter');
const path = require('path');
const args = process.argv || [];
const test = args.some(arg => arg.includes('jasmine'));
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const morgan = require('./config/morgan');
const logger = require('./config/logger');

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(__dirname, '.prod.env') });
} else {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

// Configure mail client
const mailgun = new Mailgun(formData);
const mailgunClient = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  url: 'https://api.eu.mailgun.net',
});
const mailgunDomain = process.env.MAILGUN_DOMAIN;

const config = {
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || '', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse', // Don't forget to change to https if needed
  liveQuery: {
    classNames: ['Posts', 'Comments'], // List of classes to support for query subscriptions
  },

  // Enable email verification
  verifyUserEmails: true,

  // Set email verification token validity to 1 hour
  emailVerifyTokenValidityDuration: 1 * 60 * 60,

  // The public URL of your app.
  // This will appear in the link that is used to verify email addresses and reset passwords.
  // Set the mount path as it is in serverURL
  publicServerURL: process.env.SERVER_URL,

  // Your apps name. This will appear in the subject and body of the emails that are sent.
  appName: process.env.APP_NAME,

  emailAdapter: {
    module: 'parse-server-api-mail-adapter',
    options: {
      // The email address from which emails are sent.
      sender: 'My Custom App Notifications <noreply@example.com>',
      // The email templates.
      templates: {
        // The template used by Parse Server to send an email for password
        // reset; this is a reserved template name.
        passwordResetEmail: {
          subjectPath: './templates/password_reset_email_subject.txt',
          textPath: './templates/password_reset_email.txt',
          htmlPath: './templates/password_reset_email.html',
        },
        // The template used by Parse Server to send an email for email
        // address verification; this is a reserved template name.
        verificationEmail: {
          subjectPath: './templates/verification_email_subject.txt',
          textPath: './templates/verification_email.txt',
          htmlPath: './templates/verification_email.html',
        },
        // A custom email template that can be used when sending emails
        // from Cloud Code; the template name can be chosen freely; it
        // is possible to add various custom templates.
        customEmail: {
          subjectPath: './templates/custom_email_subject.txt',
          textPath: './templates/custom_email.txt',
          htmlPath: './templates/custom_email.html',
          // Placeholders are filled into the template file contents.
          // For example, the placeholder `{{appName}}` in the email
          // will be replaced the value defined here.
          placeholders: {
            appName: process.env.APP_NAME,
          },
          // Extras to add to the email payload that is accessible in the
          // `apiCallback`.
          extra: {
            replyTo: 'somebody@example.com',
          },
          // A callback that makes the Parse User accessible and allows
          // to return user-customized placeholders that will override
          // the default template placeholders. It also makes the user
          // locale accessible, if it was returned by the `localeCallback`,
          // and the current placeholders that will be augmented.
          // eslint-disable-next-line no-unused-vars
          placeholderCallback: async ({ user, locale, placeholders }) => {
            return {
              username: user.get('username'),
            };
          },
          // A callback that makes the Parse User accessible and allows
          // to return the locale of the user for template localization.
          localeCallback: async user => {
            return user.get('locale');
          },
        },
      },
      // The asynchronous callback that contains the composed email payload to
      // be passed on to an 3rd party API and optional meta data. The payload
      // may need to be converted specifically for the API; conversion for
      // common APIs is conveniently available in the `ApiPayloadConverter`.
      // Below is an example for the Mailgun client.
      // eslint-disable-next-line no-unused-vars
      apiCallback: async ({ payload, locale }) => {
        const mailgunPayload = ApiPayloadConverter.mailgun(payload);
        await mailgunClient.messages.create(mailgunDomain, mailgunPayload);
      },
    },
  },

  // The password policy
  passwordPolicy: {
    // Enforce a password of exactly 5 numeric characters, shouldn't start with 0 and not all numbers can be equal
    validatorPattern: /^([1-9])(?!\1+$)\d{4}$/,
    // optional error message to be sent instead of the default "Password does not meet the Password Policy requirements." message.
    validationError:
      'PIN must consist of exactly 5 digits (which cannot all be the same, like 22222) and cannot start with zero',
    //optional setting to set a validity duration for password reset links (in seconds)
    resetTokenValidityDuration: 1 * 60 * 60, // expire after 1 hour
  },

  // https://github.com/parse-community/parse-server#custom-pages
  // https://stackoverflow.com/questions/69298774/parse-server-how-to-translate-the-pages-of-email-confirmation-and-password-res
  customPages: {
    passwordResetSuccess: process.env.SERVER_BASE + '/public/pages/password_reset_success.html',
    verifyEmailSuccess: process.env.SERVER_BASE + '/public/pages/verify_email_success.html',
    invalidVerificationLink:
      process.env.SERVER_BASE + '/public/pages/invalid_verification_link.html',
    invalidLink: process.env.SERVER_BASE + '/public/pages/invalid_link.html',
    choosePassword: process.env.SERVER_BASE + '/public/pages/choose_password.html',
    linkSendSuccess: process.env.SERVER_BASE + '/public/pages/link_send_success.html',
    linkSendFail: process.env.SERVER_BASE + '/public/pages/link_send_fail.html',
  },
};

// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

const app = express();
app.enable('trust proxy');

if (process.env.NODE_ENV === 'production') {
  // Initalize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],

    // Sample rate can be set as a decimal between 0 and 1
    // representing the percent of transactions to record
    //
    // For our example, we will collect all transactions
    tracesSampleRate: 1.0,
  });

  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

if (!test) {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
// app.use(helmet());

// parse json request body
// app.use(express.json());

// parse urlencoded request body
// app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
// app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
const mountPath = process.env.PARSE_MOUNT || '/parse';

if (!test) {
  app.use(function (req, res, next) {
    res.set({
      // since there is no res.header class in Parse, we use the equivalent to set the response headers
      'Access-Control-Allow-Origin': '*/*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept, X-Parse-Session-Token',
    });
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, X-Parse-Session-Token'
    );

    next();
  });

  const api = new ParseServer(config);
  app.use(mountPath, api);
}

// Parse Server plays nicely with the rest of your web routes
app.get('/', function (req, res) {
  res.status(httpStatus.OK).send('Hello there, stranger ...');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
// app.get('/test', function (req, res) {
//   res.sendFile(path.join(__dirname, '/public/test.html'));
// });

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(httpStatus.NOT_FOUND));
});

if (process.env.NODE_ENV === 'production') {
  // The error handler must be before any other error middleware
  app.use(Sentry.Handlers.errorHandler());
}

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || httpStatus.INTERNAL_SERVER_ERROR).json(err);
});

const port = process.env.PORT || 1337;
if (!test) {
  const httpServer = require('http').createServer(app);
  httpServer.listen(port, function () {
    logger.info(`my-parse-server-app running on port ${port}`);
  });
  // This will enable the Live Query real-time server
  ParseServer.createLiveQueryServer(httpServer);

  const exitHandler = () => {
    if (httpServer) {
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  };

  const unexpectedErrorHandler = error => {
    logger.error(error);
    exitHandler();
  };

  process.on('uncaughtException', unexpectedErrorHandler);
  process.on('unhandledRejection', unexpectedErrorHandler);

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    if (httpServer) {
      httpServer.close();
    }
  });
}

const dashboardConfig = {
  apps: [
    {
      serverURL: process.env.SERVER_URL,
      appId: process.env.APP_ID,
      masterKey: process.env.MASTER_KEY,
      appName: process.env.DASHBOARD_APP_NAME,
    },
  ],
  users: [
    { user: process.env.PARSE_DASHBOARD_USER_ID, pass: process.env.PARSE_DASHBOARD_USER_PASSWORD },
  ],
  useEncryptedPasswords: process.env.ENCRYPTED_PASSWORDS === 'true' ? true : false,
};
const dashboardOptions = {
  allowInsecureHTTP: process.env.INSECURE_HTTP === 'true' ? true : false,
  trustProxy: 1,
};

const dashApp = express();
dashApp.enable('trust proxy');

if (process.env.NODE_ENV === 'production') {
  // Initalize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express.js middleware tracing
      new Tracing.Integrations.Express({ dashApp }),
    ],

    // Sample rate can be set as a decimal between 0 and 1
    // representing the percent of transactions to record
    //
    // For our example, we will collect all transactions
    tracesSampleRate: 1.0,
  });

  // The request handler must be the first middleware on the app
  dashApp.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  dashApp.use(Sentry.Handlers.tracingHandler());
}

if (!test) {
  dashApp.use(morgan.successHandler);
  dashApp.use(morgan.errorHandler);
}

// // set security HTTP headers
// dashApp.use(helmet());

// // parse json request body
// dashApp.use(express.json());

// // parse urlencoded request body
// dashApp.use(express.urlencoded({ extended: true }));

// // sanitize request data
// dashApp.use(xss());
// dashApp.use(mongoSanitize());

// // gzip compression
// dashApp.use(compression());

// // enable cors
// dashApp.use(cors());
// dashApp.options('*', cors());

// Serve the ParseDashboard on the /dashboard URL prefix
const dashboardMountPath = process.env.PARSE_DASHBOARD_MOUNT || '/dashboard';

if (!test) {
  const dashboard = new ParseDashboard(
    // Parse Dashboard settings
    dashboardConfig,
    dashboardOptions
  );
  dashApp.use(dashboardMountPath, dashboard);
}

// catch 404 and forward to error handler
// dashApp.use((req, res, next) => {
// next(createError(httpStatus.NOT_FOUND));
// });

if (process.env.NODE_ENV === 'production') {
  // The error handler must be before any other error middleware
  dashApp.use(Sentry.Handlers.errorHandler());
}

// error handler
// eslint-disable-next-line no-unused-vars
//dashApp.use((err, req, res, next) => {
//  res.status(err.status || httpStatus.INTERNAL_SERVER_ERROR).json(err);
//});

const dashboardPort = process.env.DASHBOARD_PORT || 4040;
if (!test) {
  const httpServerDash = require('http').createServer(dashApp);
  httpServerDash.listen(dashboardPort, function () {
    logger.info(`my-parse-dashboard-server running on port ${dashboardPort}`);
  });

  const exitHandler = () => {
    if (httpServerDash) {
      httpServerDash.close(() => {
        logger.info('Server closed');
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  };

  const unexpectedErrorHandler = error => {
    logger.error(error);
    exitHandler();
  };

  process.on('uncaughtException', unexpectedErrorHandler);
  process.on('unhandledRejection', unexpectedErrorHandler);

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    if (httpServerDash) {
      httpServerDash.close();
    }
  });
}

module.exports = {
  app,
  config,
  dashApp,
  dashboardConfig,
};
