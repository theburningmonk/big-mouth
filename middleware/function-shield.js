'use strict';

const FunctionShield = require('@puresec/function-shield');

module.exports = () => {
  return {
    before: (handler, next) => {
      FunctionShield.configure({
        policy: {
            // 'block' mode => active blocking
            // 'alert' mode => log only
            // 'allow' mode => allowed, implicitly occurs if key does not exist
            outbound_connectivity: "block",
            read_write_tmp: "block", 
            create_child_process: "block" },
        token: process.env.FUNCTION_SHIELD_TOKEN 
      });

      next();
    }
  };
};