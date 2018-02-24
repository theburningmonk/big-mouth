'use strict';

const _ = require('lodash');
const co = require('co');
const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();
const sns = new AWS.SNS();
const streamName = process.env.order_events_stream;
const restaurantTopicArn = process.env.restaurant_notification_topic;
const chance = require('chance').Chance();

let notifyRestaurantOfOrder = co.wrap(function* (order) {
  if (chance.bool({likelihood: 75})) { // 75% chance of failure
    throw new Error('boom');
  }

  let pubReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantTopicArn
  };
  yield sns.publish(pubReq).promise();

  console.log(`notified restaurant [${order.restaurantName}] of order [${order.orderId}]`);

  let data = _.clone(order);
  data.eventType = 'restaurant_notified';
  
  let putRecordReq = {
    Data: JSON.stringify(data),
    PartitionKey: order.orderId,
    StreamName: streamName
  };
  yield kinesis.putRecord(putRecordReq).promise();

  console.log(`published 'restaurant_notified' event to Kinesis`);
});

module.exports = {
  restaurantOfOrder: notifyRestaurantOfOrder
};