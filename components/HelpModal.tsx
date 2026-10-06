import { useDialogFocus } from '../hooks/useDialogFocus';
import React, { useRef } from 'react';
import { X, Eye, Download, ClipboardPen, Layout, TextSearch, Columns } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const builtBy: {
    name: string;
    href?: string;
    links: Array<{ label: string; href: string }>;
  } = {
    name: 'Omar Badri',
    href: 'https://omarbadri.dev',
    links: [
      { label: 'GitHub', href: 'https://github.com/omarbdri' },
      { label: 'X', href: 'https://x.com/omarbdri' },
    ],
  };

  useDialogFocus(isOpen, dialogRef, closeButtonRef, onClose);

  if (!isOpen) return null;

  const features = [
    {
      icon: <Layout className="text-blue-500" size={24} />,
      title: 'Distraction-Free Writing',
      description: 'The UI fades away automatically while you type.',
    },
    {
      icon: <ClipboardPen className="text-teal-500" size={24} />,
      title: 'Smart Pasting',
      description:
        'Text pasted from other sources is highlighted so you can maintain your own voice.',
    },
    {
      icon: <Eye className="text-indigo-500" size={24} />,
      title: 'Focus Mode',
      description: 'Highlight the current paragraph and dim the rest to stay focused.',
    },
    {
      icon: <TextSearch className="text-pink-500" size={24} />,
      title: 'Style Check',
      description: 'Identify weasel words, adverbs, and passive voice to tighten your prose.',
    },
    {
      icon: <Download className="text-green-500" size={24} />,
      title: 'Export Options',
      description: 'Download your work as Markdown, HTML, or PDF.',
    },
    {
      icon: <Columns className="text-orange-500" size={24} />,
      title: 'Split View',
      description: 'Write and preview your formatted text side-by-side.',
    },
    // {
    //   icon: <Moon className="text-amber-500" size={24} />,
    //   title: 'Dark Mode',
    //   description:
    //     'Easy on the eyes for late-night writing sessions. Toggle it anytime from the toolbar.',
    // },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="w0-help-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h2
            id="w0-help-title"
            className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            write0 Features
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Close help dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-4 p-2 rounded-lg">
                <div className="flex-shrink-0 mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pt-4 pb-5 bg-transparent flex flex-col items-center gap-3">
          <button
            onClick={onClose}
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-14 py-2 rounded-xl font-medium hover:opacity-90 transition-opacity active:scale-95 shadow-sm"
          >
            Got it
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <span>Built by </span>
            {builtBy.href ? (
              <a
                href={builtBy.href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
              >
                {builtBy.name}
              </a>
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-200">{builtBy.name}</span>
            )}
            {builtBy.links.length > 0 ? <span className="mx-2">•</span> : null}
            {builtBy.links.map((link, idx) => (
              <React.Fragment key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {link.label}
                </a>
                {idx < builtBy.links.length - 1 ? <span className="mx-2">•</span> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
