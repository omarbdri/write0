import React, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { STYLE_RULES, StyleRule } from '../constants';
import { PastedRange } from '../types';
import { Eraser } from 'lucide-react';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onTyping: () => void;
  focusMode: boolean;
  typewriterMode: boolean;
  styleCheck: boolean;
  isSplitMode?: boolean;
  pastedRanges?: PastedRange[];
  onPastedRangesChange?: (ranges: PastedRange[]) => void;
  highlightPastedText: boolean;
  onCursorOffsetChange?: (offset: number) => void;
}

// Check if position is in a pasted range
function isPositionPasted(pos: number, ranges: PastedRange[]): boolean {
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

function toGlobalRegex(regex: RegExp): RegExp {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  return new RegExp(regex.source, flags);
}

function renderStyleCheckedText(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return text;

  // 1. Gather all matches
  const allMatches: { start: number; end: number; rule: StyleRule }[] = [];
  for (const rule of STYLE_RULES) {
    const re = toGlobalRegex(rule.regex);
    let match;
    while ((match = re.exec(text)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        rule,
      });
    }
  }

  // 2. Sort by Priority DESC (Higher priority processes first)
  allMatches.sort((a, b) => b.rule.priority - a.rule.priority || a.start - b.start);

  // 3. Filter overlaps
  const matches: typeof allMatches = [];
  const occupied: { start: number; end: number }[] = [];

  for (const m of allMatches) {
    const isBlocked = occupied.some((r) => m.start < r.end && m.end > r.start);
    if (!isBlocked) {
      matches.push(m);
      occupied.push({ start: m.start, end: m.end });
    }
  }

  // 4. Sort by Start position for linear rendering
  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const m of matches) {
    if (m.start > lastIndex) {
      parts.push(text.substring(lastIndex, m.start));
    }
    parts.push(
      <span key={`${keyPrefix}-${m.start}`} className={m.rule.color}>
        {text.substring(m.start, m.end)}
      </span>,
    );
    lastIndex = m.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

function getLineHeightPx(el: HTMLElement): number {
  const computed = window.getComputedStyle(el);
  const lineHeightRaw = computed.lineHeight;

  if (lineHeightRaw.endsWith('px')) {
    const px = Number.parseFloat(lineHeightRaw);
    return Number.isFinite(px) ? px : 20;
  }

  const fontSizePx = Number.parseFloat(computed.fontSize);
  const unitless = Number.parseFloat(lineHeightRaw);
  if (Number.isFinite(fontSizePx) && Number.isFinite(unitless)) {
    return unitless * fontSizePx;
  }

  return Number.isFinite(fontSizePx) ? fontSizePx * 1.75 : 20;
}

type CaretMeasurer = {
  mirror: HTMLDivElement;
  textNode: Text;
  marker: HTMLSpanElement;
};

function createCaretMeasurer(): CaretMeasurer {
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordWrap = 'break-word';

  const textNode = document.createTextNode('');
  const marker = document.createElement('span');
  marker.textContent = '\u200b';

  mirror.appendChild(textNode);
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  return { mirror, textNode, marker };
}

function syncMirrorStyles(textarea: HTMLTextAreaElement, mirror: HTMLDivElement) {
  const computed = window.getComputedStyle(textarea);
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.fontStyle = computed.fontStyle;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.textAlign = computed.textAlign;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.whiteSpace = computed.whiteSpace;
  mirror.style.overflowWrap = computed.overflowWrap;
  mirror.style.wordBreak = computed.wordBreak;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
}

function centerCaretInTextarea(
  textarea: HTMLTextAreaElement,
  measurer: CaretMeasurer,
  caretIndex: number,
) {
  if (textarea.clientWidth === 0 || textarea.clientHeight === 0) return;

  const clampedIndex = Math.max(0, Math.min(caretIndex, textarea.value.length));

  syncMirrorStyles(textarea, measurer.mirror);
  measurer.textNode.data = textarea.value.slice(0, clampedIndex);

  const caretTop = measurer.marker.offsetTop;
  const lineHeight = getLineHeightPx(textarea);
  const desiredScrollTop = caretTop - textarea.clientHeight / 2 + lineHeight / 2;

  const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
  const clamped = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));

  if (Math.abs(textarea.scrollTop - clamped) > 0.5) {
    textarea.scrollTop = clamped;
  }
}

export const Editor: React.FC<EditorProps> = ({
  content,
  onChange,
  onTyping,
  focusMode,
  typewriterMode,
  styleCheck,
  isSplitMode,
  pastedRanges = [],
  onPastedRangesChange,
  highlightPastedText,
  onCursorOffsetChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [cursorOffset, setCursorOffset] = useState(0);

  const caretMeasurerRef = useRef<CaretMeasurer | null>(null);
  const pendingTypewriterCenterRef = useRef(false);
  const pendingTypewriterCaretIndexRef = useRef(0);

  // Track selection for calculating diffs correctly
  const selectionRef = useRef({ start: 0, end: 0 });

  // Track previous content to detect edits
  const prevContentRef = useRef(content);
  // Mark when a paste happens to avoid double-processing
  const justPastedRef = useRef(false);

  // State for the active suggestion card
  const [activeMatch, setActiveMatch] = useState<{
    rule: StyleRule;
    text: string;
    index: number;
  } | null>(null);

  // State for the clear-highlight toolbar
  const [toolbarState, setToolbarState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    selectionStart: number;
    selectionEnd: number;
  }>({ visible: false, x: 0, y: 0, selectionStart: 0, selectionEnd: 0 });

  // Debounced check for style suggestions at cursor
  useEffect(() => {
    if (!styleCheck) {
      setActiveMatch(null);
      return;
    }

    const handler = setTimeout(() => {
      // Don't check if we are selecting a range (too noisy)
      if (selectionRef.current.start !== selectionRef.current.end) {
        setActiveMatch(null);
        return;
      }

      const cursor = selectionRef.current.start;
      // We look at the paragraph around the cursor to avoid scanning whole doc
      // Simple approximation: scan 500 chars around cursor
      const checkStart = Math.max(0, cursor - 500);
      const checkEnd = Math.min(content.length, cursor + 500);
      const chunk = content.substring(checkStart, checkEnd);
      const relCursor = cursor - checkStart;

      const matchesAtCursor: { rule: StyleRule; text: string; index: number }[] = [];

      // Find all matches covering the cursor
      for (const rule of STYLE_RULES) {
        const re = toGlobalRegex(rule.regex);
        let match;
        while ((match = re.exec(chunk)) !== null) {
          const mStart = match.index;
          const mEnd = mStart + match[0].length;
          if (relCursor >= mStart && relCursor <= mEnd) {
            matchesAtCursor.push({ rule, text: match[0], index: checkStart + mStart });
          }
        }
      }

      // Pick best by priority
      matchesAtCursor.sort((a, b) => b.rule.priority - a.rule.priority);
      setActiveMatch(matchesAtCursor[0] || null);
    }, 300);

    return () => clearTimeout(handler);
  }, [content, cursorOffset, styleCheck]);

  // Sync content refs when content prop updates externally
  useEffect(() => {
    prevContentRef.current = content;
  }, [content]);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    setToolbarState((prev) => ({ ...prev, visible: false }));
  };

  const syncBackdropScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    return () => {
      const measurer = caretMeasurerRef.current;
      if (measurer) {
        measurer.mirror.remove();
        caretMeasurerRef.current = null;
      }
    };
  }, []);

  // Run typewriter centering after the new content has been laid out.
  useLayoutEffect(() => {
    if (!typewriterMode) return;
    if (!pendingTypewriterCenterRef.current) return;

    const textarea = textareaRef.current;
    pendingTypewriterCenterRef.current = false;

    if (!textarea) return;
    if (!caretMeasurerRef.current) {
      caretMeasurerRef.current = createCaretMeasurer();
    }

    centerCaretInTextarea(textarea, caretMeasurerRef.current, pendingTypewriterCaretIndexRef.current);
    syncBackdropScroll();
  }, [content, typewriterMode, syncBackdropScroll]);

  const calculateNewRanges = (
    currentRanges: PastedRange[],
    changeStart: number,
    deletedLength: number,
    insertedLength: number,
  ): PastedRange[] => {
    let newRanges = [...currentRanges];

    // 1. Handle Deletions
    if (deletedLength > 0) {
      const deletionEnd = changeStart + deletedLength;
      newRanges = newRanges
        .map((range) => {
          // Case A: Range is completely before deletion -> Unchanged
          if (range.end <= changeStart) return range;

          // Case B: Range is completely after deletion -> Shift left
          if (range.start >= deletionEnd) {
            return { ...range, start: range.start - deletedLength, end: range.end - deletedLength };
          }

          // Case C: Overlap/Inside
          const overlapStart = Math.max(range.start, changeStart);
          const overlapEnd = Math.min(range.end, deletionEnd);
          const overlapLen = Math.max(0, overlapEnd - overlapStart);

          if (overlapLen >= range.end - range.start) return null;

          const mapPoint = (p: number) => {
            if (p <= changeStart) return p;
            if (p >= deletionEnd) return p - deletedLength;
            return changeStart;
          };

          const nStart = mapPoint(range.start);
          const nEnd = mapPoint(range.end);

          if (nEnd <= nStart) return null;

          return { start: nStart, end: nEnd };
        })
        .filter((r): r is PastedRange => r !== null);
    }

    // 2. Handle Insertions
    if (insertedLength > 0) {
      newRanges = newRanges.flatMap((range) => {
        // Case A: Insert after range -> Unchanged
        if (changeStart >= range.end) return [range];

        // Case B: Insert before range -> Shift right
        if (changeStart <= range.start) {
          return [
            { ...range, start: range.start + insertedLength, end: range.end + insertedLength },
          ];
        }

        // Case C: Insert strictly inside range -> Split
        // range.start < changeStart < range.end
        return [
          { start: range.start, end: changeStart },
          { start: changeStart + insertedLength, end: range.end + insertedLength },
        ];
      });
    }

    return newRanges;
  };

  // --- History Management ---
  const historyRef = useRef<{
    stack: Array<{
      content: string;
      ranges: PastedRange[];
      selection: { start: number; end: number };
    }>;
    currentIndex: number;
    lastEditTime: number;
  }>({
    stack: [], // Will be initialized by effect
    currentIndex: -1,
    lastEditTime: 0,
  });

  const isUndoingRef = useRef(false);

  // Initialize history and handle updates
  useEffect(() => {
    // If this update was triggered by our own Undo/Redo, handle cursor restoration and skip saving
    if (isUndoingRef.current) {
      const state = historyRef.current.stack[historyRef.current.currentIndex];
      if (state && textareaRef.current) {
        // Restore cursor/selection
        textareaRef.current.setSelectionRange(state.selection.start, state.selection.end);
        selectionRef.current = state.selection;
        setCursorOffset(state.selection.start);
        onCursorOffsetChange?.(state.selection.start);
      }
      isUndoingRef.current = false;
      return;
    }

    const currentHistory = historyRef.current;
    const now = Date.now();

    // Determine if we should merge with the previous history entry
    // We merge if:
    // 1. We have a previous entry
    // 2. It's recent (continuous typing)
    // 3. The change is small (single character)
    // 4. We are at the tip of the stack
    const prevEntry = currentHistory.stack[currentHistory.currentIndex];

    let shouldMerge = false;
    if (prevEntry && currentHistory.currentIndex === currentHistory.stack.length - 1) {
      const timeSince = now - currentHistory.lastEditTime;
      const charDiff = Math.abs(content.length - prevEntry.content.length);
      // Merge if rapid typing (< 1s) and small change (<= 1 char)
      if (timeSince < 1000 && charDiff <= 1) {
        shouldMerge = true;
      }
    }

    const newEntry = {
      content,
      ranges: pastedRanges,
      selection: selectionRef.current,
    };

    if (shouldMerge) {
      currentHistory.stack[currentHistory.currentIndex] = newEntry;
    } else {
      // If we are not at the end of stack (undid then typed), discard future
      if (currentHistory.currentIndex < currentHistory.stack.length - 1) {
        currentHistory.stack = currentHistory.stack.slice(0, currentHistory.currentIndex + 1);
      }
      currentHistory.stack.push(newEntry);
      currentHistory.currentIndex++;
    }

    currentHistory.lastEditTime = now;
  }, [content, pastedRanges]);

  const performUndo = useCallback(() => {
    const history = historyRef.current;
    if (history.currentIndex > 0) {
      isUndoingRef.current = true;
      history.currentIndex--;
      const prevState = history.stack[history.currentIndex];
      // We must call both to keep them in sync
      onChange(prevState.content);
      if (onPastedRangesChange) {
        onPastedRangesChange(prevState.ranges);
      }
    }
  }, [onChange, onPastedRangesChange]);

  const performRedo = useCallback(() => {
    const history = historyRef.current;
    if (history.currentIndex < history.stack.length - 1) {
      isUndoingRef.current = true;
      history.currentIndex++;
      const nextState = history.stack[history.currentIndex];
      onChange(nextState.content);
      if (onPastedRangesChange) {
        onPastedRangesChange(nextState.ranges);
      }
    }
  }, [onChange, onPastedRangesChange]);

  // Intercept native undo/redo via context menu or other means
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleBeforeInput = (event: Event) => {
      const e = event as InputEvent;
      if (e.inputType === 'historyUndo') {
        event.preventDefault();
        performUndo();
      } else if (e.inputType === 'historyRedo') {
        event.preventDefault();
        performRedo();
      }
    };

    textarea.addEventListener('beforeinput', handleBeforeInput);
    return () => textarea.removeEventListener('beforeinput', handleBeforeInput);
  }, [performUndo, performRedo]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      const newCursor = e.target.selectionStart;

      const prevStart = selectionRef.current.start;
      const prevEnd = selectionRef.current.end;
      const deletedLength = prevEnd - prevStart;

      const oldContent = prevContentRef.current;

      let effectiveDeletedLength = deletedLength;
      let effectiveInsertLength = newContent.length - (oldContent.length - deletedLength);
      let effectiveChangePos = prevStart;

      // Correction for simple deletion (Backspace/Delete) without selection range
      if (effectiveInsertLength < 0) {
        effectiveDeletedLength = -effectiveInsertLength; // The missing chars
        effectiveInsertLength = 0;

        // If newCursor is less than prevStart, we assume backspace
        if (newCursor < prevStart) {
          effectiveChangePos = newCursor;
        } else {
          effectiveChangePos = prevStart;
        }
      }

      if (!justPastedRef.current && onPastedRangesChange && pastedRanges.length > 0) {
        const nextRanges = calculateNewRanges(
          pastedRanges,
          effectiveChangePos,
          effectiveDeletedLength,
          effectiveInsertLength,
        );
        onPastedRangesChange(nextRanges);
      }

      justPastedRef.current = false;
      prevContentRef.current = newContent;

      // Update selection ref to new cursor (collapsed)
      selectionRef.current = { start: newCursor, end: newCursor };

      onChange(newContent);
      onTyping();
      setCursorOffset(newCursor);
      onCursorOffsetChange?.(newCursor);
      setToolbarState((prev) => ({ ...prev, visible: false }));

      if (effectiveInsertLength > 0) {
        const insertedText = newContent.slice(
          effectiveChangePos,
          effectiveChangePos + effectiveInsertLength,
        );
        if (insertedText.includes('\n')) {
          pendingTypewriterCenterRef.current = true;
          pendingTypewriterCaretIndexRef.current = newCursor;
        }
      }
    },
    [
      onChange,
      onTyping,
      pastedRanges,
      onPastedRangesChange,
      onCursorOffsetChange,
    ],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (!pastedText || !onPastedRangesChange) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const selLen = selEnd - selStart;

      let nextRanges = [...pastedRanges];

      // 1. Delete Selection Phase
      if (selLen > 0) {
        nextRanges = nextRanges
          .map((range) => {
            if (range.end <= selStart) return range;
            if (range.start >= selEnd)
              return { ...range, start: range.start - selLen, end: range.end - selLen };

            // Overlap
            const overlapStart = Math.max(range.start, selStart);
            const overlapEnd = Math.min(range.end, selEnd);
            if (overlapEnd > overlapStart && overlapEnd - overlapStart >= range.end - range.start)
              return null;

            // Map bounds
            const mapPoint = (p: number) => {
              if (p <= selStart) return p;
              if (p >= selEnd) return p - selLen;
              return selStart;
            };
            const nStart = mapPoint(range.start);
            const nEnd = mapPoint(range.end);

            if (nEnd <= nStart) return null;
            return { start: nStart, end: nEnd };
          })
          .filter((r): r is PastedRange => r !== null);
      }

      // 2. Insert Paste Phase
      // Shift everything after selStart by pastedText.length
      type RangeWithSplitMarker = PastedRange & { __split?: true };

      const nextRangesWithMarker: RangeWithSplitMarker[] = nextRanges.map((range) => {
        if (range.start >= selStart) {
          return {
            ...range,
            start: range.start + pastedText.length,
            end: range.end + pastedText.length,
          };
        }
        // If range contains insertion point, split it
        if (range.start < selStart && range.end > selStart) {
          return { ...range, __split: true }; // Marker
        }
        return range;
      });

      // Handle updates and splits
      const finalRanges: PastedRange[] = [];
      for (const r of nextRangesWithMarker) {
        if (r.__split) {
          // Split it
          finalRanges.push({ start: r.start, end: selStart });
          finalRanges.push({ start: selStart + pastedText.length, end: r.end + pastedText.length });
        } else {
          finalRanges.push(r);
        }
      }

      // Add the NEW pasted range
      finalRanges.push({
        start: selStart,
        end: selStart + pastedText.length,
      });

      finalRanges.sort((a, b) => a.start - b.start);

      justPastedRef.current = true;
      prevContentRef.current =
        content.substring(0, selStart) + pastedText + content.substring(selEnd);
      selectionRef.current = {
        start: selStart + pastedText.length,
        end: selStart + pastedText.length,
      };

      onPastedRangesChange(finalRanges);
      setToolbarState((prev) => ({ ...prev, visible: false }));
    },
    [pastedRanges, onPastedRangesChange, content],
  );

  const updateSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = e.currentTarget;
    setCursorOffset(selectionStart);
    onCursorOffsetChange?.(selectionStart);
    selectionRef.current = { start: selectionStart, end: selectionEnd };

    // Hide toolbar if selection is collapsed
    if (selectionStart === selectionEnd) {
      setToolbarState((prev) => ({ ...prev, visible: false }));
    }
  };

  const clearPastedStyle = () => {
    if (!onPastedRangesChange) return;

    const { selectionStart, selectionEnd } = toolbarState;
    if (selectionStart === selectionEnd) return;

    // Remove the selected range from all pasted ranges
    const newRanges = pastedRanges.flatMap((range) => {
      // 1. No overlap
      if (range.end <= selectionStart || range.start >= selectionEnd) {
        return [range];
      }

      // 2. Overlap
      const chunks: PastedRange[] = [];

      // Left part?
      if (range.start < selectionStart) {
        chunks.push({ start: range.start, end: selectionStart });
      }

      // Right part?
      if (range.end > selectionEnd) {
        chunks.push({ start: selectionEnd, end: range.end });
      }

      return chunks;
    });

    onPastedRangesChange(newRanges);
    setToolbarState((prev) => ({ ...prev, visible: false }));

    // Refocus textarea (optional but good UX)
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = e.currentTarget;
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection && highlightPastedText) {
      // Check if selection overlaps with any pasted range
      const overlaps = pastedRanges.some(
        (range) => Math.max(range.start, selectionStart) < Math.min(range.end, selectionEnd),
      );

      if (overlaps) {
        // Show toolbar above the click position (approximate)
        setToolbarState({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          selectionStart,
          selectionEnd,
        });
        return;
      }
    }

    if (toolbarState.visible) {
      setToolbarState((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleSelect = updateSelection;
  const handleKeyUp = updateSelection;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onTyping();
    setToolbarState((prev) => ({ ...prev, visible: false }));

    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();

      const textarea = e.currentTarget;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const indentation = '    ';
      const nextCursor = selectionStart + indentation.length;
      const nextContent =
        content.substring(0, selectionStart) + indentation + content.substring(selectionEnd);

      if (onPastedRangesChange && pastedRanges.length > 0) {
        onPastedRangesChange(
          calculateNewRanges(
            pastedRanges,
            selectionStart,
            selectionEnd - selectionStart,
            indentation.length,
          ),
        );
      }

      prevContentRef.current = nextContent;
      selectionRef.current = { start: nextCursor, end: nextCursor };
      onChange(nextContent);
      setCursorOffset(nextCursor);
      onCursorOffsetChange?.(nextCursor);

      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    // Custom Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        performRedo();
      }
    }
  };
  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    updateSelection(e);
  };

  const currentParagraphRange = useMemo(() => {
    if (!focusMode || !content) return null;
    const beforeCursor = content.substring(0, cursorOffset);
    const afterCursor = content.substring(cursorOffset);
    const start = beforeCursor.lastIndexOf('\n') + 1;
    const endOffset = afterCursor.indexOf('\n');
    return { start, end: endOffset === -1 ? content.length : cursorOffset + endOffset };
  }, [content, cursorOffset, focusMode]);

  const renderStyledParagraph = useCallback(
    (text: string, paragraphStart: number) => {
      if (!text) return <span className="whitespace-pre-wrap"> </span>;

      const segments: { text: string; isPasted: boolean }[] = [];
      let pos = 0;

      while (pos < text.length) {
        const isPasted = isPositionPasted(paragraphStart + pos, pastedRanges);
        let segEnd = pos + 1;
        while (
          segEnd < text.length &&
          isPositionPasted(paragraphStart + segEnd, pastedRanges) === isPasted
        ) {
          segEnd++;
        }
        segments.push({ text: text.substring(pos, segEnd), isPasted });
        pos = segEnd;
      }

      return (
        <span className="whitespace-pre-wrap">
          {segments.map((seg, idx) =>
            highlightPastedText && seg.isPasted ? (
              <span key={idx} className="pasted-text">
                {seg.text}
              </span>
            ) : styleCheck ? (
              <React.Fragment key={idx}>
                {renderStyleCheckedText(seg.text, `${paragraphStart}-${idx}`)}
              </React.Fragment>
            ) : (
              <React.Fragment key={idx}>{seg.text}</React.Fragment>
            ),
          )}
        </span>
      );
    },
    [pastedRanges, styleCheck, highlightPastedText],
  );

  const renderBackdrop = useCallback(() => {
    const paragraphs = content.split('\n');
    let idx = 0;

    return paragraphs.map((para, i) => {
      const paraStart = idx;
      idx += para.length + 1;
      const isFocused =
        !focusMode ||
        (currentParagraphRange &&
          paraStart >= currentParagraphRange.start &&
          paraStart <= currentParagraphRange.end);

      return (
        <div
          key={i}
          className={`min-h-[1.75rem] ${isFocused ? 'opacity-100' : 'opacity-25 transition-opacity duration-300'}`}
        >
          {renderStyledParagraph(para, paraStart)}
          {i < paragraphs.length - 1 ? '\n' : ''}
        </div>
      );
    });
  }, [content, focusMode, currentParagraphRange, renderStyledParagraph]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50 dark:bg-[#191919] transition-colors">
      {/* Suggestion Card */}
      {activeMatch && (
        <div className="absolute top-6 right-8 z-50 w-72 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-fade-in-up pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-2 h-2 rounded-full ${
                activeMatch.rule.id === 'adverb'
                  ? 'bg-blue-500'
                  : activeMatch.rule.id === 'passive'
                    ? 'bg-green-500'
                    : activeMatch.rule.id === 'complex'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {activeMatch.rule.label}
            </span>
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
            "{activeMatch.text}"
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{activeMatch.rule.description}</p>
        </div>
      )}

      {/* Inline Clear Toolbar */}
      {toolbarState.visible && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1 animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: Math.min(window.innerWidth - 150, Math.max(10, toolbarState.x - 60)) + 'px',
            top: toolbarState.y - 50 + 'px',
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus
        >
          <button
            onClick={clearPastedStyle}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <Eraser size={14} />
            <span>Clear Paste Highlight</span>
          </button>
        </div>
      )}

      <div
        ref={backdropRef}
        className={`editor-layer pointer-events-none text-gray-800 dark:text-gray-200 ${isSplitMode ? 'split-mode' : ''} ${typewriterMode ? 'typewriter-mode' : ''}`}
        aria-hidden="true"
      >
        {renderBackdrop()}
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onPaste={handlePaste}
        onScroll={handleScroll}
        onSelect={handleSelect}
        onKeyUp={handleKeyUp}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
        className={`editor-layer absolute inset-0 bg-transparent text-transparent caret-blue-600 dark:caret-blue-400 resize-none outline-none z-10 selection:bg-blue-200/50 dark:selection:bg-blue-800/50 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 ${isSplitMode ? 'split-mode' : ''} ${typewriterMode ? 'typewriter-mode' : ''}`}
        spellCheck={false}
        placeholder="Start writing..."
        aria-label="Editor"
      />
    </div>
  );
};
