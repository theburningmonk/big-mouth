'use strict';

const co         = require('co');
const AWSXray    = require('aws-xray-sdk');
const AWS        = AWSXray.captureAWS(require('aws-sdk'));
const sns        = new AWS.SNS();
const cloudwatch = require('./cloudwatch');
const log        = require('./log');

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic;

let retryRestaurantNotification = co.wrap(function* (order) {
  let pubReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
  };
  yield cloudwatch.trackExecTime(
    "SnsPublishLatency",
    () => sns.publish(pubReq).promise()
  );

  log.debug(`order [${order.orderId}]: queued restaurant notification for retry`);

  cloudwatch.incrCount("NotifyRestaurantQueued");
});

module.exports = {
  restaurantNotification: retryRestaurantNotification
};