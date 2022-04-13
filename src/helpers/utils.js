export const delay = (ms) => {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
};

/**
 * Gets a query sting for a given value.
 * @param {array} queries - array of query strings.
 * @param {string} value - value to be found in the query string.
 * @return {string} found value.
 */
export function getQueryStringForBibleId(queries, value) {
  return queries.find((query) => query.includes(value));
}

/**
 * Gets a query variable
 * @param {string} resourceUrl - resource url with version number.
 * @param {string} variable - varibale to be found.
 * @return {string} variable value.
 */
export function getQueryVariable(resourceUrl = '', variable) {
  const query = resourceUrl.substring(1);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0].split('?')[1] == variable) {
      return pair[1];
    }
  }

  return null;
}

/**
 * check to see if we are online (connected to the internet)
 * @return {boolean}
 */
export function areWeOnline() {
  // if navigator is not defined, then we just treat as if we are online, otherwise we check the online status
  const online = !global.navigator || global.navigator.onLine;
  return online;
}
