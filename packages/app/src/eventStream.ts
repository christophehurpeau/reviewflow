/**
 * The `text/event-stream` behind `GET /api/events`: frames written to every
 * open connection, a comment every `heartbeatMs` so a proxy or the browser does
 * not drop an idle one, and a count of connections the follower is told about.
 */

export const heartbeatMs = 25_000;

/** a frame, as the wire carries it */
export const formatEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const heartbeatFrame = ": heartbeat\n\n";

export interface EventHub {
  /** `initial` frames go to this connection only; returns how it is closed */
  subscribe: (write: (chunk: string) => void, initial?: string[]) => () => void;
  broadcast: (event: string, data: unknown) => void;
  count: () => number;
}

export const createEventHub = ({
  onCountChanged,
}: {
  /** the number of open connections moved */
  onCountChanged: (count: number) => void;
}): EventHub => {
  const writers = new Set<{ write: (chunk: string) => void }>();

  const send = (
    target: { write: (chunk: string) => void },
    chunk: string,
  ): void => {
    try {
      target.write(chunk);
    } catch {
      // a socket gone away is closed by its own `close`; nothing to do here
    }
  };

  return {
    subscribe: (write, initial = []) => {
      const target = { write };
      writers.add(target);
      for (const frame of initial) send(target, frame);
      const timer = setInterval(() => {
        send(target, heartbeatFrame);
      }, heartbeatMs);
      onCountChanged(writers.size);
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        writers.delete(target);
        onCountChanged(writers.size);
      };
    },
    broadcast: (event, data) => {
      const frame = formatEvent(event, data);
      for (const target of writers) send(target, frame);
    },
    count: () => writers.size,
  };
};
