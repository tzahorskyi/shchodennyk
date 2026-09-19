export interface RequestHandle {
  signal: AbortSignal;
  isCurrent: () => boolean;
  release: () => void;
}

interface ActiveRequest {
  id: number;
  controller: AbortController;
}

export function createLatestRequestGuard() {
  let nextId = 0;
  let active: ActiveRequest | null = null;

  return {
    start(): RequestHandle {
      active?.controller.abort();
      const request = { id: ++nextId, controller: new AbortController() };
      active = request;
      return createHandle(request, () => active, () => {
        if (active?.id === request.id) active = null;
      });
    },
    cancel() {
      active?.controller.abort();
      active = null;
    },
  };
}

export function createSingleFlightGuard() {
  let nextId = 0;
  let active: ActiveRequest | null = null;

  return {
    start(): RequestHandle | null {
      if (active) return null;
      const request = { id: ++nextId, controller: new AbortController() };
      active = request;
      return createHandle(request, () => active, () => {
        if (active?.id === request.id) active = null;
      });
    },
    cancel() {
      active?.controller.abort();
      active = null;
    },
  };
}

function createHandle(
  request: ActiveRequest,
  getActive: () => ActiveRequest | null,
  release: () => void,
): RequestHandle {
  return {
    signal: request.controller.signal,
    isCurrent: () => getActive()?.id === request.id && !request.controller.signal.aborted,
    release,
  };
}
