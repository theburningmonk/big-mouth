'use strict';

const co = require('co');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic;

let retryRestaurantNotification = co.wrap(function* (order) {
  let pubReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
  };
  yield sns.publish(pubReq).promise();

  console.log(`order [${order.orderId}]: queued restaurant notification for retry`);
});

module.exports = {
  restaurantNotification: retryRestaurantNotification
};