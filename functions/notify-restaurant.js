'use strict';

const co           = require('co');
const notify       = require('../lib/notify');
const retry        = require('../lib/retry');
const flushMetrics = require('../middleware/flush-metrics');
const wrapper      = require('../middleware/wrapper');

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

module.exports.handler = wrapper(handler)
  .use(flushMetrics);