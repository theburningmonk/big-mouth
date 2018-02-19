'use strict';

const _ = require('lodash');
const co = require('co');
const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();
const sns = new AWS.SNS();
const getRecords = require('../lib/kinesis').getRecords;
const streamName = process.env.order_events_stream;
const topicArn = process.env.restaurant_notification_topic;

module.exports.handler = co.wrap(function* (event, context, cb) {
  let records = getRecords(event);
  let orderPlaced = records.filter(r => r.eventType === 'order_placed');

  for (let order of orderPlaced) {
    let pubReq = {
      Message: JSON.stringify(order),
      TopicArn: topicArn
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
  }

  cb(null, 'all done');
});