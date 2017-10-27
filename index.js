var Walker = require('node-source-walk');
var types = require('ast-module-types');
var escodegen = require('escodegen');
var getModuleType = require('get-amd-module-type');
var parser = require('esprima-fb');

/**
 * @param  {String} src - the string content or AST of an AMD module
 * @param  {Object} [options]
 * @param  {Object} [options.skipLazyLoaded] - whether or not to omit inner (non-REM) required dependencies
 * @return {String[]} List of partials/dependencies referenced in the given file
 */
module.exports = function(src, options) {
  options = options || {};

  var dependencies = [];
  var walker = new Walker({parser: parser});

  if (typeof src === 'undefined') { throw new Error('src not given'); }
  if (src === '') { return dependencies; }

  walker.walk(src, function(node) {
    var deps;

    if (!types.isTopLevelRequire(node) &&
        !types.isDefine(node) &&
        !types.isRequire(node)) {
      return;
    }

    var type = getModuleType.fromAST(node);

    if (!types.isTopLevelRequire(node) && types.isRequire(node) && type !== 'rem' && options.skipLazyLoaded) {
      return;
    }

    deps = getDependencies(node, type, options);

    if (deps.length) {
      dependencies = dependencies.concat(deps);
    }
  });

  // Avoid duplicates
  return dependencies.filter(function(dep, idx) {
    return dependencies.indexOf(dep) === idx;
  });
};

/**
 * @param   {Object} node - AST node
 * @param   {String} type - sniffed type of the module
 * @param   {Object} options - detective configuration
 * @returns {String[]} A list of file dependencies or an empty list if the type is unsupported
 */
function getDependencies(node, type, options) {
  var dependencies;

  // Note: No need to handle nodeps since there won't be any dependencies
  switch (type) {
    case 'named':
      var args = node.arguments || [];
      return getElementValues(args[1]).concat(options.skipLazyLoaded ? [] : getLazyLoadedDeps(node));
    case 'deps':
    case 'driver':
      var args = node.arguments || [];
      return getElementValues(args[0]).concat(options.skipLazyLoaded ? [] : getLazyLoadedDeps(node));
    case 'factory':
    case 'rem':
      // REM inner requires aren't really "lazy loaded," but the form is the same
      return getLazyLoadedDeps(node);
  }

  return [];
}

/**
 * Looks for dynamic module loading
 *
 * @param  {AST} node
 * @return {String[]} List of dynamically required dependencies
 */
function getLazyLoadedDeps(node) {
  // Use logic from node-detective to find require calls
  var walker = new Walker();
  var dependencies = [];
  var requireArgs;
  var deps;

  walker.traverse(node, function(innerNode) {
    if (types.isRequire(innerNode)) {
      requireArgs = innerNode.arguments;

      if (!requireArgs.length) { return; }

      // Either require('x') or require(['x'])
      deps = requireArgs[0];

      if (deps.type === 'ArrayExpression') {
        dependencies = dependencies.concat(getElementValues(deps));
      } else {
        dependencies.push(getEvaluatedValue(deps));
      }
    }
  });

  return dependencies;
}

/**
 * @param {Object} nodeArguments
 * @returns {String[]} the literal values from the passed array
 */
function getElementValues(nodeArguments) {
  var dependencies = [];
  if (nodeArguments.type === 'ArrayExpression') {
    var elements = nodeArguments.elements || [];
    dependencies = elements.map(function(el) {
      return getEvaluatedValue(el);
    }).filter(Boolean);
  } else {
    dependencies.push(getEvaluatedValue(nodeArguments));
  }
  return dependencies;
}

/**
 * @param {AST} node
 * @returns {String} the statement represented by AST node
 */
function getEvaluatedValue(node) {
  if (node.type === 'Literal' || node.type === 'StringLiteral') { return node.value; }
  if (node.type === 'CallExpression') { return ''; }
  return escodegen.generate(node);
}
