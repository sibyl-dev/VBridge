/* eslint-disable no-restricted-globals */

export const ENVIRONMENT = process.env.NODE_ENV;

console.log(ENVIRONMENT);

export const DEV_MODE = ENVIRONMENT === 'development';

export const ROOT_URL = process.env.REACT_APP_BASE_URL || (
  DEV_MODE ? 'http://localhost:7777' : location.origin
);

export const ALLOW_CORS = process.env.REACT_APP_ALLOW_CORS || ENVIRONMENT === 'development';

export default {
  ENVIRONMENT,
  ROOT_URL,
  ALLOW_CORS
};