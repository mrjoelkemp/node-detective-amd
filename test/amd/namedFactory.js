define('myModule', function(require) {
  var b = require('./b');
  var c = require('./c');

  console.log(b, c);
});
