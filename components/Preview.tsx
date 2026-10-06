import React, { useContext, useMemo } from 'react';
import ReactMarkdown, { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownForNestedLists } from '../utils/markdownUtils';

interface PreviewProps {
  content: string;
  focusMode: boolean;
  focusLine: number | null;
}

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

const DimAncestorContext = React.createContext(false);
const FocusLineContext = React.createContext<number | null>(null);

type MarkdownNodePosition = {
  position?: {
    start?: { line?: number };
    end?: { line?: number };
  };
};

function getNodeLineRange(node: unknown): { startLine: number; endLine: number } | null {
  const anyNode = node as MarkdownNodePosition | null | undefined;
  const startLine = anyNode?.position?.start?.line;
  const endLine = anyNode?.position?.end?.line;

  if (typeof startLine !== 'number' || typeof endLine !== 'number') return null;
  return { startLine, endLine };
}

// Stable component identities preserve rendered nodes as the caret moves.
function dimBoundary(tag: keyof React.JSX.IntrinsicElements) {
  return function DimBoundary({
    node,
    className,
    ...props
  }: React.HTMLAttributes<HTMLElement> & ExtraProps) {
    const dimmedByAncestor = useContext(DimAncestorContext);
    const focusLine = useContext(FocusLineContext);
    const range = getNodeLineRange(node);
    const dimmed =
      focusLine !== null &&
      range !== null &&
      (focusLine < range.startLine || focusLine > range.endLine);
    const element = React.createElement(tag, {
      ...props,
      className: cx(
        className,
        !dimmedByAncestor && 'transition-opacity duration-300 ease-in-out',
        !dimmedByAncestor && (dimmed ? 'opacity-25' : 'opacity-100'),
      ),
    });
    return (
      <DimAncestorContext.Provider value={dimmedByAncestor || dimmed}>
        {element}
      </DimAncestorContext.Provider>
    );
  };
}

const markdownComponents: Components = {
  p: dimBoundary('p'),
  h1: dimBoundary('h1'),
  h2: dimBoundary('h2'),
  h3: dimBoundary('h3'),
  h4: dimBoundary('h4'),
  h5: dimBoundary('h5'),
  h6: dimBoundary('h6'),
  blockquote: dimBoundary('blockquote'),
  pre: dimBoundary('pre'),
  li: dimBoundary('li'),
  table: dimBoundary('table'),
  hr: dimBoundary('hr'),
};

export const Preview: React.FC<PreviewProps> = ({ content, focusMode, focusLine }) => {
  const normalized = useMemo(() => normalizeMarkdownForNestedLists(content), [content]);

  return (
    <div className="h-full overflow-y-auto px-8 pt-12 pb-8 bg-white dark:bg-gray-900 transition-colors">
      <article className="w0-prose prose prose-lg dark:prose-invert prose-headings:font-sans prose-p:font-sans prose-a:text-blue-600 mx-auto prose-code:before:content-none prose-code:after:content-none [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none">
        <FocusLineContext.Provider value={focusMode ? focusLine : null}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {normalized}
          </ReactMarkdown>
        </FocusLineContext.Provider>
      </article>
      <div className="h-20"></div>
    </div>
  );
};
