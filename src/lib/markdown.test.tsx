import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown, safeUrl } from './markdown'

const html = (src: string) => renderToStaticMarkup(<Markdown source={src} />)

describe('markdown', () => {
  it('renders headings, emphasis, code and lists', () => {
    expect(html('# Title')).toBe('<h3>Title</h3>')
    expect(html('a **b** *c* `d`')).toBe('<p>a <strong>b</strong> <em>c</em> <code>d</code></p>')
    expect(html('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(html('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
    expect(html('```\nx < y\n```')).toBe('<pre><code>x &lt; y</code></pre>')
  })

  it('joins wrapped lines into one paragraph and splits on blank lines', () => {
    expect(html('one\ntwo\n\nthree')).toBe('<p>one two</p><p>three</p>')
  })

  it('never emits raw HTML', () => {
    expect(html('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(html('<img src=x onerror=alert(1)>')).not.toContain('<img')
  })

  it('links only http(s) URLs, opened safely', () => {
    expect(html('[docs](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a></p>',
    )
    expect(html('[x](javascript:alert(1))')).not.toContain('<a')
    expect(safeUrl('data:text/html,hi')).toBe(false)
    expect(safeUrl('not a url')).toBe(false)
  })
})
