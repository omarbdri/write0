import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, FileText, Trash2, Search, X, Edit2, Check, CircleHelp, Coffee } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Document } from '../types';

interface SidebarProps {
  documents: Document[];
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (id: string) => void;
  onRenameDoc: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onTriggerHelp: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onRenameDoc,
  isOpen,
  onClose,
  onTriggerHelp,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameDoc(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const matches =
      q.length === 0
        ? documents
        : documents.filter(
            (doc) => doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q),
          );

    return [...matches].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, searchTerm]);

  return (
    <div
      inert={!isOpen}
      className={`fixed inset-y-0 left-0 z-40 md:z-0 w-72 bg-white dark:bg-gray-900/95 backdrop-blur-sm border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
      } md:static md:h-full md:shadow-none shadow-2xl`}
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-shrink-0">
        <h1 className="font-mono font-medium text-xl text-gray-800 dark:text-gray-100">write0</h1>
        <button
          onClick={onClose}
          className="md:hidden text-gray-500 hover:text-gray-800 dark:hover:text-white"
        >
          <span className="sr-only">Close sidebar</span>
          <X size={20} />
        </button>
      </div>

      {/* Search & Actions */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-neutral-400" size={16} />
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search documents"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 dark:text-neutral-100"
          />
        </div>
        <button
          onClick={onCreateDoc}
          className="w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 rounded-xl text-sm font-medium hover:shadow-md active:scale-[0.98] transition-all duration-200"
        >
          <Plus size={16} />
          New Document
        </button>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
        <div className="space-y-1.5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                activeDocId === doc.id
                  ? 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700/50'
                  : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/50 hover:translate-x-1'
              }`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <div
                className={`flex flex-1 min-w-0 ${editingId === doc.id ? 'items-center' : 'items-start'} gap-3 overflow-hidden`}
              >
                <FileText
                  size={18}
                  className={`${editingId === doc.id ? '' : 'mt-0.5'} flex-shrink-0 ${
                    activeDocId === doc.id ? 'text-blue-500' : 'text-gray-400'
                  }`}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  {editingId === doc.id ? (
                    <input
                      ref={editInputRef}
                      aria-label="Document title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium bg-gray-100 dark:bg-gray-700 border-none focus:ring-0 focus:outline-none rounded px-1 py-0.5 w-full"
                    />
                  ) : (
                    <button
                      type="button"
                      aria-current={activeDocId === doc.id ? 'page' : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDoc(doc.id);
                      }}
                      className="flex flex-col min-w-0 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                    >
                      <span
                        className={`text-sm font-medium truncate ${activeDocId === doc.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        {doc.title || 'Untitled'}
                      </span>
                      <span className="text-xs text-gray-400 truncate">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={(e) => {
                    if (editingId === doc.id) {
                      e.preventDefault();
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingId === doc.id) handleSaveRename();
                    else handleStartRename(e, doc);
                  }}
                  className={`${
                    editingId === doc.id
                      ? 'opacity-100 text-green-600 dark:text-green-400'
                      : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 text-gray-400 hover:text-blue-500'
                  } p-1.5 rounded transition-all`}
                  aria-label={editingId === doc.id ? 'Save document title' : 'Rename document'}
                >
                  {editingId === doc.id ? <Check size={14} /> : <Edit2 size={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDoc(doc.id);
                  }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded transition-all"
                  aria-label="Delete document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredDocs.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No documents found.</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between gap-3">
        <Tooltip content="About" position="top">
          <button
            onClick={onTriggerHelp}
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200 active:scale-95"
            aria-label="About write0"
          >
            <CircleHelp size={18} />
          </button>
        </Tooltip>

        <a
          href="https://buymeacoffee.com/omarbadri"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-white dark:bg-gray-900 hover:bg-yellow-300 dark:hover:bg-yellow-300 dark:hover:text-gray-900 text-gray-900 dark:text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
        >
          <Coffee size={18} />
          <span>Buy me a coffee</span>
        </a>
      </div>
    </div>
  );
};
