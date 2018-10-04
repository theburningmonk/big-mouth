'use strict';

const co       = require('co');
const AWSXray  = require('aws-xray-sdk');
const AWS      = AWSXray.captureAWS(require('aws-sdk'));
const dynamodb = new AWS.DynamoDB.DocumentClient();
const wrapper  = require('../middleware/wrapper');

const defaultResults = process.env.defaultResults || 8;
const tableName = process.env.restaurants_table;

function* findRestaurantsByTheme(theme, count) {
  let req = {
    TableName: tableName,
    Limit: count,
    FilterExpression: "contains(themes, :theme)",
    ExpressionAttributeValues: { ":theme": theme }
  };

  let resp = yield dynamodb.scan(req).promise();
  return resp.Items;
}

const handler = co.wrap(function* (event, context, cb) {
  let req = JSON.parse(event.body);
  let restaurants = yield findRestaurantsByTheme(req.theme, defaultResults);
  let response = {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  }

  cb(null, response);
});

module.exports.handler = wrapper(handler);