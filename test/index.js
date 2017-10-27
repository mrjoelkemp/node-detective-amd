var detective = require('../');
var fs     = require('fs');
var assert = require('assert');
var path   = require('path');

describe('detective-amd', function() {
  function getDepsOf(filepath, options) {
    var src = fs.readFileSync(path.resolve(__dirname, filepath), 'utf8');
    return detective(src, options);
  }

  it('accepts an AST', function() {
    var amdAST = {
      type: 'Program',
      body: [{
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'define'
          },
          arguments: [
            {
              type: 'ArrayExpression',
              elements: []
            },
            {
              type: 'FunctionExpression',
              id: null,
              params: [],
              defaults: [],
              body: {
                type: 'BlockStatement',
                body: []
              },
              rest: null,
              generator: false,
              expression: false
            }
          ]
        }
      }]
    };

    var deps = detective(amdAST);
    assert(!deps.length);
  });

  it('supports es6', function() {
    assert.doesNotThrow(function() {
      detective('define({ foo() {}});');
    });
  });

  it('supports jsx', function() {
    assert.doesNotThrow(function() {
      detective('define({ foo: function(){ return <jsx />; } });');
    });
  });

  it('returns and empty list on an empty file', function() {
    var results = detective('');
    assert.equal(results.length, 0);
  });

  it('throws if the source content is not given', function() {
    assert.throws(function() {
      detective();
    });
  });

  it('returns the dependencies of the factory form', function() {
    var deps = getDepsOf('./amd/factory.js');
    assert(deps.length === 2);
    assert(deps[0] === './b');
    assert(deps[1] === './c');
  });

  it('returns the an empty list for the no dependency form', function() {
    var deps = getDepsOf('./amd/nodep.js');
    assert(deps.length === 0);
  });

  it('returns the dependencies of the named form', function() {
    var deps = getDepsOf('./amd/named.js');
    assert(deps.length === 1);
    assert(deps[0] === 'a');
  });

  it('returns the dependencies of the named factory', function() {
    var deps = getDepsOf('./amd/namedFactory.js');
    assert(deps.length === 2);
    assert(deps[0] === './b');
    assert(deps[1] === './c');
  });

  it('returns the dependencies of the dependency form', function() {
    var deps = getDepsOf('./amd/dep.js');
    assert(deps.length === 2);
    assert(deps[0] === './a');
    assert(deps[1] === './b');
  });

  it('returns the dependencies for the REM form (#2)', function() {
    var deps = getDepsOf('./amd/rem.js');
    assert(deps.length === 2);
    assert(deps[0] === 'a');
    assert(deps[1] === 'b');
  });

  it('returns the emtpy list for non-amd modules', function() {
    var deps = getDepsOf('./amd/empty.js');
    assert(!deps.length);
  });

  it('returns the dependencies of a driver script', function() {
    var deps = getDepsOf('./amd/driver.js');
    assert(deps.length === 1);
    assert(deps[0] === './a');
  });

  it('includes dynamic requires as dependencies', function() {
    var deps = getDepsOf('./amd/dynamicRequire.js');
    assert(deps.length === 2);
    assert(deps[0] === './a');
    assert(deps[1] === './b');
  });

  it('handles nested driver scripts', function() {
    var deps = getDepsOf('./amd/IIFEWithDriver.js');
    assert(deps.length === 2);
    assert(deps[0] === 'a');
    assert(deps[1] === 'b');
  });

  it('skips dynamic computed dependencies', function() {
    var deps = getDepsOf('./amd/dynamicComputedRequire.js');
    assert(deps.length === 1);
    assert(deps[0] === './a');
  });

  it('expression-based define expressions', function() {
    var deps = getDepsOf('./amd/expressionDefine.js');
    assert(deps.length === 1);
    assert(deps[0] === 'depList + [\'anotherBar\']');
  });

  describe('when given the option to omit lazy loaded requires', function() {
    it('does not include them in the list of dependencies', function() {
      var deps = getDepsOf('./amd/dynamicRequire.js', {
        skipLazyLoaded: true
      });

      assert.equal(deps.length, 1);
      assert.equal(deps[0], './a');
    });

    it('still returns the inner dependencies of an REM-form module', function() {
      var deps = getDepsOf('./amd/rem.js', {
        skipLazyLoaded: true
      });

      assert.equal(deps.length, 2);
      assert.equal(deps[0], 'a');
      assert.equal(deps[1], 'b');
    });
  });
});
