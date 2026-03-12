import { LRUCache } from 'lru-cache';
import logger from './logger.js';

const options = {
    // max size of cache
    max: 500,
    // how long to keep items in ms (15 minutes default)
    ttl: 1000 * 60 * 15,
    // allow stale items while refreshing
    allowStale: true,
    updateAgeOnGet: false,
    updateAgeOnHas: false
};

const cache = new LRUCache(options);

export const cacheService = {
    get: key => {
        const value = cache.get(key);
        if (value) {
            logger.debug(`Cache HIT for key: ${key}`);
        } else {
            logger.debug(`Cache MISS for key: ${key}`);
        }
        return value;
    },
    set: (key, value, ttl = options.ttl) => {
        logger.debug(`Cache SET for key: ${key}`);
        return cache.set(key, value, { ttl });
    },
    del: key => {
        logger.debug(`Cache DEL for key: ${key}`);
        return cache.delete(key);
    },
    clear: () => {
        logger.debug('Cache CLEAR');
        return cache.clear();
    }
};

export default cacheService;
