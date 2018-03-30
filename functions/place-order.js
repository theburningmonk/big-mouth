'use strict';

const co = require('co');
const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();
const chance = require('chance').Chance();
const log = require('../lib/log');
const streamName = process.env.order_events_stream;

module.exports.handler = co.wrap(function* (event, context, cb) {
  let body = JSON.parse(event.body);
  log.debug('request body is a valid JSON', { requestBody: event.body });
  let restaurantName = JSON.parse(event.body).restaurantName;

  let userEmail = event.requestContext.authorizer.claims.email;

  let orderId = chance.guid();
  log.debug(`placing order...`, { orderId, restaurantName, userEmail });

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
  yield kinesis.putRecord(putReq).promise();

  log.debug("published event to Kinesis...", { eventName: 'order_placed' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  };

  cb(null, response);
});