import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Editor } from '../components/Editor';
import { PastedRange } from '../types';
import { getPastedSegments, getTextChange, updatePastedRanges } from '../utils/editorUtils';

function Harness({ initial = '' }: { initial?: string }) {
  const [content, setContent] = useState(initial);
  const [ranges, setRanges] = useState<PastedRange[]>([]);
  return (
    <>
      <Editor
        content={content}
        onChange={setContent}
        onTyping={() => {}}
        focusMode={false}
        typewriterMode={false}
        styleCheck={false}
        pastedRanges={ranges}
        onPastedRangesChange={setRanges}
        highlightPastedText={true}
      />
      <output data-testid="ranges">{JSON.stringify(ranges)}</output>
    </>
  );
}

describe('editor history', () => {
  it('preserves the initial state through the first typing burst and supports redo', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox', { name: 'Editor' });
    fireEvent.change(textarea, { target: { value: 'a', selectionStart: 1 } });
    fireEvent.change(textarea, { target: { value: 'ab', selectionStart: 2 } });
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    expect((textarea as HTMLTextAreaElement).value).toBe('');
    fireEvent.keyDown(textarea, { key: 'z', metaKey: true, shiftKey: true });
    expect((textarea as HTMLTextAreaElement).value).toBe('ab');
  });

  it('drops the redo branch after editing an undone document', () => {
    render(<Harness initial="original" />);
    const textarea = screen.getByRole('textbox', { name: 'Editor' });
    fireEvent.change(textarea, { target: { value: 'replacement', selectionStart: 11 } });
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    fireEvent.change(textarea, { target: { value: 'new branch', selectionStart: 10 } });
    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true });
    expect((textarea as HTMLTextAreaElement).value).toBe('new branch');
  });

  it('lets Shift+Tab move focus out of the editor', () => {
    render(<Harness />);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', shiftKey: true })).toBe(
      true,
    );
  });
});

describe('paste tracking', () => {
  it('keeps a one-character paste separate from subsequent typing in undo history', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox');
    fireEvent.paste(textarea, { clipboardData: { getData: () => 'a' } });
    fireEvent.change(textarea, { target: { value: 'a', selectionStart: 1 } });
    fireEvent.change(textarea, { target: { value: 'ab', selectionStart: 2 } });
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    expect((textarea as HTMLTextAreaElement).value).toBe('a');
    expect(screen.getByTestId('ranges').textContent).toBe('[{"start":0,"end":1}]');
  });

  it('uses native newline normalization and restores paste metadata on undo/redo', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox');
    fireEvent.paste(textarea, { clipboardData: { getData: () => 'a\r\nb' } });
    fireEvent.change(textarea, { target: { value: 'a\nb', selectionStart: 3 } });
    expect(screen.getByTestId('ranges').textContent).toBe('[{"start":0,"end":3}]');
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('ranges').textContent).toBe('[]');
    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true });
    expect(screen.getByTestId('ranges').textContent).toBe('[{"start":0,"end":3}]');
  });

  it('maps insertions, replacements and word deletions through pasted ranges', () => {
    expect(updatePastedRanges([{ start: 2, end: 8 }], 4, 0, 2)).toEqual([
      { start: 2, end: 4 },
      { start: 6, end: 10 },
    ]);
    expect(updatePastedRanges([{ start: 2, end: 8 }], 1, 4, 1)).toEqual([{ start: 2, end: 5 }]);
    expect(updatePastedRanges([{ start: 2, end: 8 }], 0, 10, 0)).toEqual([]);
    expect(getTextChange('one two three', 'one three', 4)).toEqual({
      start: 4,
      deletedLength: 4,
      insertedLength: 0,
    });
    expect(getTextChange('aaaa', 'aaaaa', 1)).toEqual({
      start: 0,
      deletedLength: 0,
      insertedLength: 1,
    });
  });

  it('renders clipped and overlapping ranges without duplicating text', () => {
    expect(
      getPastedSegments('abcdef', 10, [
        { start: 9, end: 12 },
        { start: 11, end: 14 },
      ]),
    ).toEqual([
      { text: 'ab', isPasted: true },
      { text: 'cd', isPasted: true },
      { text: 'ef', isPasted: false },
    ]);
  });

  it('keeps the backdrop text identical to the textarea across blank lines', () => {
    const { container } = render(<Harness initial={'a\n\nb\n'} />);
    expect(container.querySelector('[aria-hidden="true"].editor-layer')?.textContent).toBe(
      'a\n\nb\n\u200b',
    );
  });
});
