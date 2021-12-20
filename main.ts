import { readAll } from "https://deno.land/std@0.118.0/streams/mod.ts";

function wait() {
  return new Promise((resolve) => setTimeout(resolve));
}

function debounce<I, T extends I[], R>(
  ms: number,
  fn: (...args: T) => Promise<R> | R
) {
  let timer: number | undefined;

  return (...args: T) => {
    if (timer) clearTimeout(timer);

    return (
      new Promise<R>((resolve) => {
        timer = setTimeout(resolve, ms);
      })
        //
        .then(() => fn(...args))
    );
  };
}

const decoder = new TextDecoder();
const decode = (byte: Uint8Array) => decoder.decode(byte);
const readTextFrom = (path: string) =>
  Deno.open(path).then(readAll).then(decode);

function handleFileChange({ kind, paths }: Deno.FsEvent) {
  if (kind === "create" || kind === "modify") {
    return Promise.all(paths.map(readTextFrom));
  }
}

// fake thread
function thread(fn: () => void) {
  fn();
}

// fake channel
function channel<T>() {
  const buffer: T[] = [];

  const receiver = {
    [Symbol.asyncIterator]: () => ({
      async next() {
        while (!buffer.length) await wait();

        return { value: buffer.pop(), done: false };
      },
    }),
  };

  const send = (msg: T) => buffer.push(msg);

  return { receiver, send };
}

function main() {
  const { receiver, send } = channel<string>();

  thread(async () => {
    const handle = debounce(300, handleFileChange);

    for await (const event of Deno.watchFs("./source")) {
      handle(event)
        .then((messages) => messages?.map(send))
        .catch(console.error);
    }
  });

  thread(async () => {
    for await (const msg of receiver) {
      console.log(msg);
    }
  });
}

main();
