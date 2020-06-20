const winston = require('winston');

winston.configure({
  // level: 'info',
  // format: winston.format.json(),
  // defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({ 
      level: 'debug',
      format: winston.format.combine(
        // winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ 
      filename: 'logs/output.log', 
      level: 'debug',
      format: winston.format.combine( 
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
    }),
  ],
});

module.exports = winston;
