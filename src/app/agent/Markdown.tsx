import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isDesktop, openExternal } from "../platform/desktop";

/**
 * The agent's replies are Markdown. Rendered with the app's own type, no raw
 * HTML (react-markdown escapes it), and links open outside the app.
 */
const components: Components = {
  p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-ink-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-ink-3">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <p className="mt-3 font-semibold text-ink first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-3 font-semibold text-ink first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-3 font-semibold text-ink first:mt-0">{children}</p>,
  code: ({ children }) => (
    <code className="rounded bg-hover px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-hover p-3 text-sm [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      // The desktop window has no tabs: the link goes to the person's browser
      onClick={(event) => {
        if (!isDesktop() || !href) return;
        event.preventDefault();
        void openExternal(href);
      }}
      className="text-accent-ink underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-ink-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2 py-1">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-base leading-relaxed text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
