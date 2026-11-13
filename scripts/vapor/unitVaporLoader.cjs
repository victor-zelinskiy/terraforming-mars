/*
 * THE UNIT BUNDLE'S PRE-LOADER FOR `.vue` (scripts/vapor/unitVaporPolicy.cjs has the whole reasoning).
 *
 * A Vapor component the policy sends to the VIRTUAL DOM (an entry of the valve, or a `TM_UNIT_VAPOR=none` run) reaches
 * `vue-loader` without its `vapor` attribute — the same script, the same template, compiled for the virtual DOM.
 * Nothing else of the source is touched (the attribute is a whole word inside the opening tag of the `<script>` /
 * `<template>` block; line and column numbers stay — only that word's characters leave its line).
 */
'use strict';

const {unitCompilesAsVapor} = require('./unitVaporPolicy.cjs');

const VAPOR_ATTR = /(<(?:script|template)\b[^>]*?)\svapor(?=[\s=>/])/g;

module.exports = function unitVaporLoader(source) {
  if (unitCompilesAsVapor(this.resourcePath)) {
    return source;
  }
  return source.replace(VAPOR_ATTR, '$1');
};
