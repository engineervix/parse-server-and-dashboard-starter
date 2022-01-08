<!-- omit in toc -->
# parse-server-and-dashboard-starter

A production-ready project using the [parse-server](https://github.com/ParsePlatform/parse-server) and [parse-dashboard](https://github.com/parse-community/parse-dashboard) modules on Express. Read the full [Parse Server Guide](https://docs.parseplatform.org/parse-server/guide/) for more information.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [About](#about)
- [Local Development](#local-development)
  - [Helpful Scripts](#helpful-scripts)
- [Deployment](#deployment)
- [Using Parse Server](#using-parse-server)
  - [Health Check](#health-check)
  - [APIs and SDKs](#apis-and-sdks)
    - [REST API](#rest-api)
    - [JavaScript](#javascript)
    - [Android](#android)
    - [iOS / tvOS / iPadOS / macOS (Swift)](#ios--tvos--ipados--macos-swift)
- [TODO](#todo)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## About

This builds up on [parse-community/parse-server-example](https://github.com/parse-community/parse-server-example), with several modifications and additions, including:

- [parse-dashboard](https://github.com/parse-community/parse-dashboard)
- email configuration with custom templates
- Nginx config for deployment on a Linux server
- Production process-management via [PM2](https://pm2.io/)
- Production Error tracking via [Sentry](https://sentry.io/)
- Logging via [winston](https://www.npmjs.com/package/winston)
- HTTP request logging via [morgan](https://www.npmjs.com/package/morgan)
- [dotenv](https://www.npmjs.com/package/dotenv) to load environment variables from a `.env` file into [process.env](https://nodejs.org/docs/latest/api/process.html#process_process_env).
- [cross-env](https://www.npmjs.com/package/cross-env) for running scripts that set and use environment variables across platforms
- [nodemon](https://www.npmjs.com/package/nodemon) for automatically restarting the node application when file changes in the directory are detected
<!-- - Additional middleware, including [helmet](https://www.npmjs.com/package/helmet), [npm i express-mongo-sanitize](express-mongo-sanitize), [xss-clean](https://www.npmjs.com/package/xss-clean) -->

## Local Development

- Make sure you have at least Node 4.3. `node --version`
- Clone this repo and change directory to it.
- Make a copy of `.env.example` and rename it to `.env`, then update the Environment Variables accordingly
- `docker-compose up -d --build`
- By default it will use a path of `/parse` for the API routes.  To change this, or use older client SDKs, run `export PARSE_MOUNT=/1` before launching the server.
- You now have a database named "dev" that contains your Parse data
- Install ngrok and you can test with devices

### Helpful Scripts

These scripts can help you to develop your app for Parse Server:

- `npm run watch` will start your Parse Server and restart if you make any changes.
- `npm run lint` will check the linting of your cloud code, tests and `index.js`, as defined in `.eslintrc.json`.
- `npm run lint-fix` will attempt fix the linting of your cloud code, tests and `index.js`.
- `npm run prettier` will help improve the formatting and layout of your cloud code, tests and `index.js`, as defined in `.prettierrc`.
- `npm run test` will run any tests that are written in `/spec`.
- `npm run coverage` will run tests and check coverage. Output is available in the `/coverage` folder.

## Deployment

See <https://derkinzi.de/how-to-run-parse-dashboard-alongside-parse-server-on-digital-ocean/> for Nginx configuration.

Also have a look at <https://www.sitepoint.com/parse-platform-back4app-beginner-guide/>.

You will need to make a copy of `.prod.env.example` and rename it to `.prod.env`, then update the Environment Variables accordingly.

If you need to setup MongoDB and PM2 on your server, you might find the [scripts/ubuntu_setup.sh](scripts/ubuntu_setup.sh) file useful.

There's a production ready [Nginx configuration](config/nginx/nginx.conf.example) file which you can tweak to your preferences. Generally, the configuration is based on a server bootstrapped using [engineervix/ubuntu-server-setup](https://github.com/engineervix/ubuntu-server-setup) -- you will find some of the referenced files in the **configuration_files** directory in this repo.

## Using Parse Server

### Health Check

You can use the `/health` endpoint to verify that Parse Server is up and running. For example, for local deployment, enter this URL in your browser:

> [http://localhost:1337/parse/health](http://localhost:1337/parse/health)

If you deployed Parse Server remotely, change the URL accordingly.

### APIs and SDKs

Use the REST API, GraphQL API or any of the Parse SDKs to see Parse Server in action. Parse Server comes with a variety of SDKs to cover most common ecosystems and languages, such as JavaScript, Swift, ObjectiveC and Android just to name a few.

The following shows example requests when interacting with a local deployment of Parse Server. If you deployed Parse Server remotely, change the URL accordingly.

#### REST API

Save object:

```sh
curl -X POST \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{"score":1337}' \
  http://localhost:1337/parse/classes/GameScore
```

Call Cloud Code function:

```sh
curl -X POST \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d "{}" \
  http://localhost:1337/parse/functions/hello
```

#### JavaScript

```js
// Initialize SDK
Parse.initialize("YOUR_APP_ID", "unused");
Parse.serverURL = 'http://localhost:1337/parse';

// Save object
const obj = new Parse.Object('GameScore');
obj.set('score',1337);
await obj.save();

// Query object
const query = new Parse.Query('GameScore');
const objAgain = await query.get(obj.id);
```

#### Android

```java
// Initialize SDK in the application class
Parse.initialize(new Parse.Configuration.Builder(getApplicationContext())
  .applicationId("YOUR_APP_ID")
  .server("http://localhost:1337/parse/")   // '/' important after 'parse'
  .build());

// Save object
ParseObject obj = new ParseObject("TestObject");
obj.put("foo", "bar");
obj.saveInBackground();
```

#### iOS / tvOS / iPadOS / macOS (Swift)

```swift
// Initialize SDK in AppDelegate
Parse.initializeWithConfiguration(ParseClientConfiguration(block: {
  (configuration: ParseMutableClientConfiguration) -> Void in
    configuration.server = "http://localhost:1337/parse/" // '/' important after 'parse'
    configuration.applicationId = "YOUR_APP_ID"
}))
```

You can change the server URL in all of the open-source SDKs, but we're releasing new builds which provide initialization time configuration of this property.

## TODO

- [ ] Fix broken tests
