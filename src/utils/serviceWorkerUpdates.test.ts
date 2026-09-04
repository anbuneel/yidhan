import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  activateWaitingUpdate,
  registerServiceWorker,
  resetServiceWorkerRegistrationForTests,
} from './serviceWorkerUpdates';

describe('serviceWorkerUpdates', () => {
  beforeEach(() => {
    resetServiceWorkerRegistrationForTests();
    vi.clearAllMocks();
  });

  it('registers immediately so a waiting worker is picked up on load', async () => {
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    const registrar = vi.fn().mockReturnValue(applyUpdate);

    const registered = await registerServiceWorker({ registrar });

    expect(registered).toBe(true);
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0][0]).toMatchObject({ immediate: true });
  });

  it('registers only once even if called again', async () => {
    const registrar = vi.fn().mockReturnValue(vi.fn());

    await registerServiceWorker({ registrar });
    await registerServiceWorker({ registrar });

    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('forwards the need-refresh signal to the caller', async () => {
    const onNeedRefresh = vi.fn();
    let captured: (() => void) | undefined;
    const registrar = vi.fn().mockImplementation((options) => {
      captured = options.onNeedRefresh;
      return vi.fn();
    });

    await registerServiceWorker({ registrar, onNeedRefresh });
    captured?.();

    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
  });

  it('hands over to the waiting worker without reloading', async () => {
    const applyUpdate = vi.fn().mockResolvedValue(undefined);
    await registerServiceWorker({ registrar: vi.fn().mockReturnValue(applyUpdate) });

    const activated = await activateWaitingUpdate();

    expect(activated).toBe(true);
    // The caller owns the reload — reloading here would bypass the cooldown
    // that stops chunk-error recovery from looping.
    expect(applyUpdate).toHaveBeenCalledWith(false);
  });

  it('reports no activation when registration never happened', async () => {
    await expect(activateWaitingUpdate()).resolves.toBe(false);
  });

  it('reports no activation when the worker rejects the handover', async () => {
    const applyUpdate = vi.fn().mockRejectedValue(new Error('no waiting worker'));
    await registerServiceWorker({ registrar: vi.fn().mockReturnValue(applyUpdate) });

    await expect(activateWaitingUpdate()).resolves.toBe(false);
  });
});
