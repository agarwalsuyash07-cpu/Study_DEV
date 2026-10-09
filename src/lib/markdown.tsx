import type { ReactNode } from 'react'

// Tiny Markdown subset rendered straight to React elements: no innerHTML anywhere, so notes can't inject markup.
// ponytail: headings, paragraphs, lists, fenced code, **bold**, *italic*, `code`, [links](https://…); add a library if tables etc. are needed.

/** Only http(s) URLs become links (blocks javascript:, data:, …). */
export function safeUrl(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { protocol } = new URL(url)
  return protocol === 'https:' || protocol === 'http:'
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/

function inline(text: string): ReactNode[] {
  return text.split(INLINE).flatMap((part, i): ReactNode[] => {
    if (!part) return []
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return [<code key={i}>{part.slice(1, -1)}</code>]
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return [<strong key={i}>{part.slice(2, -2)}</strong>]
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return [<em key={i}>{part.slice(1, -1)}</em>]
    const link = LINK.exec(part)
    if (link && safeUrl(link[2]!)) {
      return [
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>,
      ]
    }
    return [part]
  })
}

export function Markdown({ source }: { source: string }) {
  const out: ReactNode[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(' '))}</p>)
    para = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>)
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>)
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trimStart().startsWith('```')) {
      flushPara()
      flushList()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i]!.trimStart().startsWith('```'); i++) code.push(lines[i]!)
      out.push(
        <pre key={out.length}>
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      flushList()
      const level = heading[1]!.length
      const content = inline(heading[2]!)
      out.push(level === 1 ? <h3 key={out.length}>{content}</h3> : level === 2 ? <h4 key={out.length}>{content}</h4> : <h5 key={out.length}>{content}</h5>)
    } else if (bullet || numbered) {
      flushPara()
      const ordered = !bullet
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1]!)
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()
  return <>{out}</>
}
