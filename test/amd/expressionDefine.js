var depList = ['bar','baz'];
define('foo', depList + ['anotherBar'], function(a) {
  'use strict';

  return a;
});
