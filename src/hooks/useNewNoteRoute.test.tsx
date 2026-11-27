import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNewNoteRoute, type UseNewNoteRouteOptions } from './useNewNoteRoute';

type Props = Pick<UseNewNoteRouteOptions, 'requested' | 'ready'>;

function setup(initial: Props, { strict = false, result = true }: { strict?: boolean; result?: boolean | Error } = {}) {
  let finish: (() => void) | undefined;
  const create = vi.fn((open: (noteId: string) => void) => new Promise<boolean>((resolve, reject) => {
    finish = () => {
      if (result instanceof Error) reject(result);
      else {
        if (result) open('note-1');
        resolve(result);
      }
    };
  }));
  const open = vi.fn();
  const onFailed = vi.fn();
  const wrapper = strict ? ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> : undefined;
  const hook = renderHook((props: Props) => useNewNoteRoute({ ...props, create, open, onFailed }), {
    initialProps: initial,
    wrapper,
  });
  const settle = async () => {
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
  };
  return { ...hook, create, open, onFailed, settle };
}

describe('useNewNoteRoute (item 44)', () => {
  it('creates one note and opens it', async () => {
    const { create, open, onFailed, settle } = setup({ requested: true, ready: true });
    expect(create).toHaveBeenCalledOnce();
    await settle();
    expect(open).toHaveBeenCalledWith('note-1');
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('creates once under StrictMode', async () => {
    const { create, open, settle } = setup({ requested: true, ready: true }, { strict: true });
    await settle();
    expect(create).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });

  it('waits while signed out or locked, then creates once ready', () => {
    const { create, rerender } = setup({ requested: true, ready: false });
    expect(create).not.toHaveBeenCalled();
    rerender({ requested: true, ready: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it('does not create again when readiness flickers on the same arrival', () => {
    const { create, rerender } = setup({ requested: true, ready: true });
    rerender({ requested: true, ready: false });
    rerender({ requested: true, ready: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it('never creates on another route', () => {
    const { create } = setup({ requested: false, ready: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates again on a new arrival at /n/new', async () => {
    const { create, rerender, settle } = setup({ requested: true, ready: true });
    await settle();
    rerender({ requested: false, ready: true });
    rerender({ requested: true, ready: true });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('reports a failed or thrown create', async () => {
    const failed = setup({ requested: true, ready: true }, { result: false });
    await failed.settle();
    expect(failed.onFailed).toHaveBeenCalledOnce();
    expect(failed.open).not.toHaveBeenCalled();

    const thrown = setup({ requested: true, ready: true }, { result: new Error('disk') });
    await thrown.settle();
    expect(thrown.onFailed).toHaveBeenCalledOnce();
  });

  it('leaves a reader who moved on where they went', async () => {
    const { open, rerender, settle } = setup({ requested: true, ready: true });
    rerender({ requested: false, ready: true });
    await settle();
    expect(open).not.toHaveBeenCalled();
  });
});
