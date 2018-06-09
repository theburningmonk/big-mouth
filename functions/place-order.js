'use strict';

const co             = require('co');
const kinesis        = require('../lib/kinesis');
const chance         = require('chance').Chance();
const log            = require('../lib/log');
const cloudwatch     = require('../lib/cloudwatch');
const correlationIds = require('../lib/correlation-ids');
const streamName     = process.env.order_events_stream;

const middy = require('middy');
const sampleLogging = require('../middleware/sample-logging');
const captureCorrelationIds = require('../middleware/capture-correlation-ids');

const handler = co.wrap(function* (event, context, cb) {
  let body = JSON.parse(event.body);
  log.debug('request body is a valid JSON', { requestBody: event.body });
  let restaurantName = JSON.parse(event.body).restaurantName;

  let userEmail = event.requestContext.authorizer.claims.email;

  let orderId = chance.guid();
  log.debug(`placing order...`, { orderId, restaurantName, userEmail });

  correlationIds.set('order-id', orderId);
  correlationIds.set('restaurant-name', restaurantName);
  correlationIds.set('user-email', userEmail);

  let data = {
    orderId,
    userEmail,
    restaurantName,
    eventType: 'order_placed'
  };

  let putReq = {
    Data: JSON.stringify(data),
    PartitionKey: orderId,
    StreamName: streamName
  };
  yield cloudwatch.trackExecTime(
    "KinesisPutRecordLatency",
    () => kinesis.putRecord(putReq).promise()
  );

  log.debug("published event to Kinesis...", { eventName: 'order_placed' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  cb(null, response);
});

module.exports.handler = middy(handler)
  .use(captureCorrelationIds({ sampleDebugLogRate: 0.01 }))
  .use(sampleLogging({ sampleRate: 0.01 }));