import { parseInline, parsePostBlocks } from '@/lib/post-blocks';

describe('parseInline', () => {
  it('parses bold/italic/link into spans', () => {
    const spans = parseInline('Plain <b>bold</b> and <i>italic</i> and <a href="https://x.com">link</a>');
    expect(spans).toEqual([
      { text: 'Plain ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
      { text: ' and ' },
      { text: 'link', link: 'https://x.com' },
    ]);
  });

  it('decodes entities, keeps <br> and strips unknown tags', () => {
    const spans = parseInline('A&nbsp;&amp;&nbsp;B<br><span style="color:red">red</span>');
    expect(spans.map((s) => s.text).join('')).toBe('A & B\nred');
  });
});

describe('parsePostBlocks', () => {
  it('parses header/paragraph/list (legacy string-items format)', () => {
    const blocks = parsePostBlocks(JSON.stringify({
      blocks: [
        { type: 'header', data: { text: 'Heading', level: 2 } },
        { type: 'paragraph', data: { text: 'Text' } },
        { type: 'list', data: { style: 'ordered', items: ['one', 'two'] } },
      ],
    }));
    expect(blocks).toEqual([
      { kind: 'header', level: 2, spans: [{ text: 'Heading' }] },
      { kind: 'paragraph', spans: [{ text: 'Text' }] },
      { kind: 'list', ordered: true, items: [[{ text: 'one' }], [{ text: 'two' }]] },
    ]);
  });

  it('parses nested editorjs-list v2 and image', () => {
    const blocks = parsePostBlocks(JSON.stringify({
      blocks: [
        {
          type: 'list',
          data: {
            style: 'unordered',
            items: [{ content: 'top', items: [{ content: 'nested', items: [] }] }],
          },
        },
        { type: 'image', data: { file: { url: '/uploads/images/a.png' }, caption: 'Caption' } },
      ],
    }));
    expect(blocks[0]).toEqual({
      kind: 'list',
      ordered: false,
      items: [[{ text: 'top' }], [{ text: 'nested' }]],
    });
    expect(blocks[1]).toEqual({ kind: 'image', url: '/uploads/images/a.png', caption: 'Caption' });
  });

  it('broken JSON and empty content yield an empty list', () => {
    expect(parsePostBlocks('{oops')).toEqual([]);
    expect(parsePostBlocks(null)).toEqual([]);
    expect(parsePostBlocks('')).toEqual([]);
  });
});
