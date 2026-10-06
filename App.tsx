import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Document, AppSettings, PastedRange } from './types';
import { INITIAL_DOC_ID, INITIAL_FOLDER_ID, WELCOME_CONTENT } from './constants';
import {
  Eye,
  Monitor,
  Columns,
  TextSearch,
  Moon,
  Sun,
  PanelLeft,
  Share,
  ClipboardPen,
  AlignCenter,
} from 'lucide-react';
import { Tooltip } from './components/Tooltip';
import { HelpModal } from './components/HelpModal';
import { ConfirmModal } from './components/ConfirmModal';
import { readJson, writeJson, STORAGE_KEYS, StorageKey } from './utils/storageUtils';
import { restoreDocuments, restoreSettings } from './utils/stateUtils';
import { usePersistentStorage } from './hooks/usePersistentStorage';

const App: React.FC = () => {
  const [storageErrors, setStorageErrors] = useState<Partial<Record<StorageKey, string>>>({});
  const storageError = Object.values(storageErrors).find(Boolean);

  // --- State ---
  const [documents, setDocuments] = useState<Document[]>(() => {
    const fallback: Document[] = [
      {
        id: INITIAL_DOC_ID,
        title: 'Welcome',
        content: WELCOME_CONTENT,
        folderId: INITIAL_FOLDER_ID,
        updatedAt: Date.now(),
      },
    ];

    return restoreDocuments(readJson<unknown>(STORAGE_KEYS.documents, fallback), fallback);
  });

  const [activeDocId, setActiveDocId] = useState<string>(() => {
    return readJson<string>(STORAGE_KEYS.activeDocumentId, INITIAL_DOC_ID);
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    return restoreSettings(readJson<unknown>(STORAGE_KEYS.settings, null));
  });

  // Distraction free typing state
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  // Help Modal state
  const [showHelp, setShowHelp] = useState(false);

  // Confirm delete state
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  // Cursor position (for focus mode syncing with Preview)
  const [cursorOffset, setCursorOffset] = useState(0);

  // --- Derived State ---
  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId),
    [documents, activeDocId],
  );

  const focusLine = useMemo(() => {
    if (!settings.focusMode) return null;
    const text = activeDoc?.content ?? '';
    const clamped = Math.max(0, Math.min(cursorOffset, text.length));
    let line = 1;
    for (let i = 0; i < clamped; i++) {
      if (text[i] === '\n') line++;
    }
    return line;
  }, [activeDoc?.content, cursorOffset, settings.focusMode]);

  useEffect(() => {
    if (documents.length === 0) return;
    if (documents.some((d) => d.id === activeDocId)) return;
    setActiveDocId(documents[0].id);
  }, [documents, activeDocId]);

  useEffect(() => {
    setCursorOffset(0);
  }, [activeDocId]);

  const wordCount = useMemo(() => {
    if (!activeDoc) return 0;
    return activeDoc.content
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }, [activeDoc]);

  const readingTime = Math.ceil(wordCount / 200);

  // --- Handlers ---
  const toggleSetting = useCallback((key: keyof AppSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // --- Effects ---
  const handleSaveResult = useCallback((result: ReturnType<typeof writeJson>, key: StorageKey) => {
    const message =
      result.ok === false
        ? result.reason === 'quota'
          ? 'Browser storage is full. Your latest changes are not saved. Export your writing before leaving.'
          : 'Browser storage is unavailable. Your latest changes are not saved. Export your writing before leaving.'
        : undefined;
    setStorageErrors((previous) => {
      if (previous[key] === message) return previous;
      return { ...previous, [key]: message };
    });
  }, []);

  usePersistentStorage(STORAGE_KEYS.documents, documents, handleSaveResult);
  usePersistentStorage(STORAGE_KEYS.activeDocumentId, activeDocId, handleSaveResult);
  usePersistentStorage(STORAGE_KEYS.settings, settings, handleSaveResult);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  // Handle typing detection to fade UI
  useEffect(() => {
    const revealControls = () => {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };

    window.addEventListener('pointermove', revealControls);
    window.addEventListener('pointerdown', revealControls);
    window.addEventListener('focusin', revealControls);
    return () => {
      window.removeEventListener('pointermove', revealControls);
      window.removeEventListener('pointerdown', revealControls);
      window.removeEventListener('focusin', revealControls);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !showHelp &&
        !deleteDocId &&
        !e.isComposing &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'b'
      ) {
        e.preventDefault();
        toggleSetting('showSidebar');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSetting, showHelp, deleteDocId]);

  // Click outside to close export menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExportMenu(false);
        exportButtonRef.current?.focus();
      }
    };
    if (showExportMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showExportMenu]);

  // --- Handlers ---
  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    // UI reappears after 1.5 seconds of inactivity
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  const handleUpdateContent = (content: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === activeDocId) {
          const updates: Partial<Document> = { content, updatedAt: Date.now() };
          if (!doc.hasCustomTitle) {
            updates.title =
              content.split('\n')[0].replace(/#+\s/, '').substring(0, 40) || 'Untitled';
          }
          return { ...doc, ...updates };
        }
        return doc;
      }),
    );
  };

  const handlePastedRangesChange = useCallback(
    (ranges: PastedRange[]) => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id === activeDocId) {
            return { ...doc, pastedRanges: ranges };
          }
          return doc;
        }),
      );
    },
    [activeDocId],
  );

  const handleRenameDoc = (id: string, title: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id ? { ...doc, title, hasCustomTitle: true, updatedAt: Date.now() } : doc,
      ),
    );
  };

  const handleCreateDoc = () => {
    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: 'Untitled',
      content: '',
      folderId: INITIAL_FOLDER_ID,
      updatedAt: Date.now(),
      hasCustomTitle: false,
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    if (window.innerWidth < 768) {
      setSettings((s) => ({ ...s, showSidebar: false }));
    }
  };

  const handleDeleteDoc = (id: string) => {
    setDeleteDocId(id);
  };

  const handleConfirmDeleteDoc = () => {
    if (!deleteDocId) return;

    const nextDocs = documents.filter((doc) => doc.id !== deleteDocId);
    setDocuments(nextDocs);
    if (activeDocId === deleteDocId) setActiveDocId(nextDocs[0]?.id ?? '');

    setDeleteDocId(null);
  };

  const handleExport = async (type: 'html' | 'md' | 'pdf') => {
    if (!activeDoc) return;
    setShowExportMenu(false);
    // Reserve the print window during the click, before loading the export module.
    const printWindow = type === 'pdf' ? window.open('', '_blank', 'width=800,height=600') : null;
    if (type === 'pdf' && !printWindow) {
      alert('Popup was blocked. Allow popups for this site to export PDF (Print).');
      return;
    }
    if (printWindow) printWindow.opener = null;
    try {
      const { exportToHTML, exportToText, exportToPDF } = await import('./utils/exportUtils');
      if (type === 'html') exportToHTML(activeDoc.title, activeDoc.content);
      if (type === 'md') exportToText(activeDoc.title, activeDoc.content);
      if (type === 'pdf') exportToPDF(activeDoc.title, activeDoc.content, printWindow);
    } catch (error) {
      printWindow?.close();
      console.error('Failed to load export tools:', error);
      alert('Export could not load. Please try again.');
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <ConfirmModal
        isOpen={deleteDocId !== null}
        title="Delete document?"
        description="This will permanently remove it from this device."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setDeleteDocId(null)}
        onConfirm={handleConfirmDeleteDoc}
      />

      {/* Sidebar - Fades out when typing */}
      <div
        inert={showHelp || deleteDocId !== null}
        className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          settings.showSidebar ? 'w-0 md:w-72' : 'w-0'
        } ${isTyping ? 'opacity-0 pointer-events-none delay-200' : 'opacity-100 delay-0'}`}
      >
        <Sidebar
          documents={documents}
          activeDocId={activeDocId}
          onSelectDoc={(id) => {
            setActiveDocId(id);
            if (window.innerWidth < 768) setSettings((s) => ({ ...s, showSidebar: false }));
          }}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
          onRenameDoc={handleRenameDoc}
          isOpen={settings.showSidebar}
          onClose={() => setSettings((s) => ({ ...s, showSidebar: false }))}
          onTriggerHelp={() => setShowHelp(true)}
        />
      </div>

      {/* Main Content */}
      <div
        inert={showHelp || deleteDocId !== null}
        className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 transition-all duration-300 relative"
      >
        {/* Top Bar - Fades out when typing */}
        <div
          className={`h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 z-20 flex-shrink-0 transition-opacity duration-700 ease-in-out ${isTyping ? 'opacity-0 pointer-events-none delay-200' : 'opacity-100 delay-0'}`}
          onFocusCapture={() => setIsTyping(false)}
        >
          <div className="flex items-center gap-4">
            <Tooltip content="Toggle Sidebar" position="right">
              <button
                onClick={() => toggleSetting('showSidebar')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400"
                aria-label="Toggle sidebar"
              >
                <PanelLeft size={20} />
              </button>
            </Tooltip>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden sm:inline-block">
              {wordCount} words <span className="mx-1">•</span> {readingTime} min read
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Tooltip content="Focus Mode" position="bottom">
              <button
                onClick={() => toggleSetting('focusMode')}
                className={`p-2 rounded-md transition-colors ${settings.focusMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                aria-label={settings.focusMode ? 'Disable focus mode' : 'Enable focus mode'}
              >
                <Eye size={18} />
              </button>
            </Tooltip>

            <Tooltip content="Typewriter Mode" position="bottom">
              <button
                onClick={() => toggleSetting('typewriterMode')}
                className={`p-2 rounded-md transition-colors hidden sm:block ${settings.typewriterMode ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                aria-label={
                  settings.typewriterMode ? 'Disable typewriter mode' : 'Enable typewriter mode'
                }
              >
                <AlignCenter size={18} />
              </button>
            </Tooltip>

            <Tooltip content="Style Check" position="bottom">
              <button
                onClick={() => toggleSetting('styleCheck')}
                className={`p-2 rounded-md transition-colors hidden sm:block ${settings.styleCheck ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                aria-label={settings.styleCheck ? 'Disable style check' : 'Enable style check'}
              >
                <TextSearch size={18} />
              </button>
            </Tooltip>

            <Tooltip content="Highlight Pasted Text" position="bottom">
              <button
                onClick={() => toggleSetting('highlightPastedText')}
                className={`p-2 rounded-md transition-colors hidden sm:block ${settings.highlightPastedText ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                aria-label={
                  settings.highlightPastedText
                    ? 'Disable pasted text highlighting'
                    : 'Enable pasted text highlighting'
                }
              >
                <ClipboardPen size={18} />
              </button>
            </Tooltip>

            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

            <Tooltip
              content={`Switch to ${settings.theme === 'light' ? 'Dark' : 'Light'} Mode`}
              position="bottom"
            >
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))
                }
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 rounded-md"
                aria-label={
                  settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
                }
              >
                {settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </Tooltip>

            <Tooltip
              content={settings.showPreview ? 'Hide Preview' : 'Show Preview'}
              position="bottom"
            >
              <button
                onClick={() => toggleSetting('showPreview')}
                className={`p-2 rounded-md transition-colors ${settings.showPreview ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                aria-label={settings.showPreview ? 'Hide preview' : 'Show preview'}
              >
                {settings.showPreview ? <Columns size={18} /> : <Monitor size={18} />}
              </button>
            </Tooltip>

            <div className="relative" ref={exportMenuRef}>
              <Tooltip content="Export" position="bottom">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={`p-2 transition-colors rounded-md ${showExportMenu ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'}`}
                  ref={exportButtonRef}
                  disabled={!activeDoc}
                  aria-expanded={showExportMenu}
                  aria-controls="export-options"
                  aria-label="Export"
                >
                  <Share size={18} />
                </button>
              </Tooltip>
              {/* Add invisible padding-top to bridge the gap if needed, though now click-based */}
              {showExportMenu && (
                <div className="absolute right-0 top-full pt-2 w-48 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div
                    id="export-options"
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1"
                  >
                    <button
                      onClick={() => handleExport('md')}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      Markdown
                    </button>
                    <button
                      onClick={() => handleExport('html')}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      HTML
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      PDF (Print)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {storageError && (
          <div
            role="alert"
            className="px-4 py-2 text-sm bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100"
          >
            {storageError}
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden relative bg-gray-50 dark:bg-[#191919]">
          {activeDoc ? (
            <>
              <div
                className={`h-full transition-all duration-300 relative ${settings.showPreview ? 'w-full md:w-1/2 md:border-r border-gray-200 dark:border-gray-700' : 'w-full'}`}
              >
                <Editor
                  key={activeDoc.id}
                  content={activeDoc.content}
                  onChange={handleUpdateContent}
                  onTyping={handleTyping}
                  focusMode={settings.focusMode}
                  typewriterMode={settings.typewriterMode}
                  styleCheck={settings.styleCheck}
                  isSplitMode={settings.showPreview}
                  pastedRanges={activeDoc.pastedRanges}
                  onPastedRangesChange={handlePastedRangesChange}
                  highlightPastedText={settings.highlightPastedText}
                  onCursorOffsetChange={setCursorOffset}
                />
              </div>
              {settings.showPreview && (
                <div className="w-1/2 h-full hidden md:block">
                  <Preview
                    content={activeDoc.content}
                    focusMode={settings.focusMode}
                    focusLine={focusLine}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
              <p>Select or create a document to start writing</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Preview Overlay */}
      {settings.showPreview && activeDoc && (
        <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-gray-900 pt-14">
          <div className="absolute top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-4 bg-white dark:bg-gray-900">
            <span className="font-bold">Preview</span>
            <button onClick={() => toggleSetting('showPreview')}>Close</button>
          </div>
          <Preview
            content={activeDoc?.content || ''}
            focusMode={settings.focusMode}
            focusLine={focusLine}
          />
        </div>
      )}
    </div>
  );
};

export default App;
