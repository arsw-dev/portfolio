const arswTheme = {
  name: 'arsw',
  type: 'dark' as const,
  colors: {
    'editor.background': '#080b10',
    'editor.foreground': '#6a8aac',
  },
  tokenColors: [
    {
      scope: ['comment', 'comment.line', 'comment.block'],
      settings: { foreground: '#3d5a78' },
    },
    {
      scope: [
        'keyword',
        'keyword.control',
        'keyword.operator',
        'keyword.declaration',
        'storage',
        'storage.type',
        'constant.language',
        'variable.language.this',
        'variable.language.super',
      ],
      settings: { foreground: '#c99030' },
    },
    {
      scope: ['string', 'string.quoted', 'string.template', 'string.regexp'],
      settings: { foreground: '#7aabcc' },
    },
    {
      scope: ['constant.numeric'],
      settings: { foreground: '#c4a882' },
    },
    {
      scope: [
        'entity.name.function',
        'entity.name.class',
        'entity.name.type',
        'entity.name.tag',
        'support.class',
        'variable',
        'meta.definition.variable',
      ],
      settings: { foreground: '#ccd5e8' },
    },
    {
      scope: [
        'variable.parameter',
        'meta.object-literal.key',
        'support.type.property-name',
        'entity.other.attribute-name',
      ],
      settings: { foreground: '#9ab8cc' },
    },
    {
      scope: ['punctuation', 'meta.brace'],
      settings: { foreground: '#3d5a78' },
    },
  ],
};

export { arswTheme };
