import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HelpModal } from '../components/HelpModal';
import { ConfirmModal } from '../components/ConfirmModal';

it('keeps focus stable across parent renders and traps Tab inside help', () => {
  const view = render(<HelpModal isOpen={true} onClose={() => {}} />);
  const gotIt = screen.getByRole('button', { name: 'Got it' });
  gotIt.focus();
  view.rerender(<HelpModal isOpen={true} onClose={() => {}} />);
  expect(document.activeElement).toBe(gotIt);
  screen.getByRole('link', { name: 'X' }).focus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close help dialog' }));
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'X' }));
});

it('returns focus to the dialog trigger on close', () => {
  const button = document.createElement('button');
  document.body.appendChild(button);
  button.focus();
  const view = render(<HelpModal isOpen={true} onClose={() => {}} />);
  view.rerender(<HelpModal isOpen={false} onClose={() => {}} />);
  expect(document.activeElement).toBe(button);
  button.remove();
});

it('does not dismiss a pending confirmation with Escape', async () => {
  const onCancel = vi.fn();
  let complete!: () => void;
  render(
    <ConfirmModal
      isOpen={true}
      title="Confirm"
      onCancel={onCancel}
      onConfirm={() =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
      }
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).not.toHaveBeenCalled();
  await act(async () => {
    complete();
  });
});
