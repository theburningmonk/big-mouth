'use strict';

const co             = require("co");
const Promise        = require("bluebird");
const fs             = Promise.promisifyAll(require("fs"));
const Mustache       = require('mustache');
const http           = require('../lib/http');
const URL            = require('url');
const aws4           = require('../lib/aws4');
const log            = require('../lib/log');
const cloudwatch     = require('../lib/cloudwatch');
const middy          = require('middy');
const {ssm, secretsManager} = require('middy/middlewares');
const sampleLogging  = require('../middleware/sample-logging');
const correlationIds = require('../middleware/capture-correlation-ids');
const AWSXRay        = require('aws-xray-sdk');
const FunctionShield = require('@puresec/function-shield');
FunctionShield.configure({
  policy: {
      // 'block' mode => active blocking
      // 'alert' mode => log only
      // 'allow' mode => allowed, implicitly occurs if key does not exist
      outbound_connectivity: "block",
      read_write_tmp: "block", 
      create_child_process: "block" },
  token: process.env.FUNCTION_SHIELD_TOKEN });

const STAGE = process.env.STAGE;
const awsRegion = process.env.AWS_REGION;
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

var html;

function* loadHtml() {
  if (!html) {
    html = yield fs.readFileAsync('static/index.html', 'utf-8');
  }

  return html;
}

function* getRestaurants(restaurantsApiRoot) {
  let url = URL.parse(restaurantsApiRoot);
  let opts = {
    host: url.hostname,
    path: url.pathname
  };

  aws4.sign(opts);

  let httpReq = http({
    uri: restaurantsApiRoot,
    headers: opts.headers
  });

  return new Promise((resolve, reject) => {
    let f = co.wrap(function*(subsegment) {
      if (subsegment) {
        subsegment.addMetadata('url', restaurantsApiRoot);
      }      
      
      try {
        let body = (yield httpReq).body;

        if (subsegment) {
          subsegment.close();
        }
        
        resolve(body);
      } catch (err) {
        if (subsegment) {
          subsegment.close(err);
        }
        
        reject(err);
      }
    });

    let segment = AWSXRay.getSegment();

    AWSXRay.captureAsyncFunc("getting restaurant", f, segment);
  });
}

const handler = co.wrap(function* (event, context, callback) {
  yield aws4.init();

  let template = yield loadHtml();
  log.debug('loaded HTML template');

  let restaurants = yield cloudwatch.trackExecTime(
    "GetRestaurantsLatency",
    () => getRestaurants(context.restaurants_api)
  );
  log.debug(`loaded ${restaurants.length} restaurants`);

  let dayOfWeek = days[new Date().getDay()];
  let view = {
    dayOfWeek, 
    restaurants,
    awsRegion,
    cognitoUserPoolId: context.cognito.user_pool_id,
    cognitoClientId: context.cognito.client_id,
    searchUrl: `${context.restaurants_api}/search`,
    placeOrderUrl: `${context.orders_api}`
  };
  let html = Mustache.render(template, view);
  log.debug(`generated HTML [${html.length} bytes]`);

  cloudwatch.incrCount("RestaurantsReturned", restaurants.length);

  yield http({ uri: 'http://google.com'});

  const response = {
    statusCode: 200,
    body: html,
    headers: {
      'content-type': 'text/html; charset=UTF-8'
    }
  };

  callback(null, response);
});

module.exports.handler = middy(handler)
  .use(correlationIds({ sampleDebugLogRate: 0.9 }))
  .use(sampleLogging({ sampleRate: 0.01 }))
  .use(ssm({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000,
    setToContext: true,
    names: {
      restaurants_api: `/bigmouth/${STAGE}/restaurants_api`,
      orders_api: `/bigmouth/${STAGE}/orders_api`,
      cognito_user_pool_id: `/bigmouth/${STAGE}/cognito_user_pool_id`,
      cognito_client_id: `/bigmouth/${STAGE}/cognito_client_id`
    }
  }))
  .use(secretsManager({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000,
    secrets: {
      cognito: `/bigmouth/${STAGE}/cognito`
    }
  }));