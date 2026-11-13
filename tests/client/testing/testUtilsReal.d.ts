/*
 * The REAL `@vue/test-utils`, under the name the Vapor-aware shim imports it by (`vaporTestUtils.ts`; the unit bundle's
 * alias — `webpack.test.config.js`). For the type checker it is the package itself.
 */
declare module '@vue/test-utils-real' {
  export * from '@vue/test-utils';
}

/** …and the REAL `vue`, under the name the bundle's `vue` shim imports it by (`vueForTests.ts`). */
declare module 'vue-real' {
  export * from 'vue';
}
