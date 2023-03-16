'use strict';

module.exports = function babelConfig(api) {
  const isTest = api.env('test');

  if (!isTest) return {};

  return {
    only: ['src'],
    presets: [
      ['pob-babel/preset.js'],
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
          development: false,
          useBuiltIns: true,
          useSpread: true,
        },
      ],
    ],
  };
};
