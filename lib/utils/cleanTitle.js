'use strict';

module.exports = (title) =>
  title
    .trim()
    .replace(/[\s-]+\[?\s*(ONK-\d+)\s*]?\s*$/, ' $1')
    .replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `);
