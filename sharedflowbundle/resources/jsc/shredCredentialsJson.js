/* jshint esversion:6, node:true, strict:implied */
/* global context */

try {
  var c = JSON.parse(context.getVariable('private.credentialsjson'));
  for (var prop in c) {
    context.setVariable('private.' + prop, c[prop]);
    //context.setVariable('json.' + prop, c[prop]);
  }
}
catch (e) {
  context.setVariable('js-callout-error', e);
  context.setVariable('js-callout-stack', e.stack);
}
