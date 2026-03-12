import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    transport: isProduction ? undefined : {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    },
    formatters: {
        level: label => {
            return { level: label.toUpperCase() };
        }
    },
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password', 'token']
});

export default logger;
