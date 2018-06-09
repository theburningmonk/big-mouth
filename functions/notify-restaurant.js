'use strict';

const co                    = require('co');
const notify                = require('../lib/notify');
const retry                 = require('../lib/retry');
const middy                 = require('middy');
const sampleLogging         = require('../middleware/sample-logging');
const flushMetrics          = require('../middleware/flush-metrics');
const captureCorrelationIds = require('../middleware/capture-correlation-ids');

const handler = co.wrap(function* (event, context, cb) {
  let events = context.parsedKinesisEvents;
  let orderPlaced = events.filter(r => r.eventType === 'order_placed');

  for (let order of orderPlaced) {
    order.scopeToThis();

    try {
      yield notify.restaurantOfOrder(order);
    } catch (err) {
      yield retry.restaurantNotification(order);
    }

    order.unscope();
  }

  cb(null, 'all done');
});

module.exports.handler = middy(handler)
  .use(captureCorrelationIds({ sampleDebugLogRate: 0.01 }))
  .use(sampleLogging({ sampleRate: 0.01 }))
  .use(flushMetrics);