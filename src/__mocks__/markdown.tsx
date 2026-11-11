// Jest stand-in for react-markdown (ESM only): the text, unformatted
export default function ReactMarkdown({ children }: { children: string }) {
  return <p>{children}</p>;
}
