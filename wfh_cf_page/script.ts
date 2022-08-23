import type { FileHasher } from 'wfh';
import createFileHasher from 'wfh';
import prettyBytes from 'pretty-bytes';

const view = initView();

createFileHasher('/wfh_wasm.wasm')
  .then((hasher: FileHasher) => {
    view.setOnInputChange((event: Event) => onInputChange({
      event,
      hasher,
      update: view.update,
    }));

    view.update({ status: 'ready' });
  })
  .catch((error: Error) => {
    view.update({ status: 'error', error });
    console.error(error);
  });

// -- Functions ---------------------------------------------------------------

function initView() {
  let container = document.getElementById('hasher') as Element;
  let input = container.querySelector('.fileInput input') as Element;
  let infoEmptyMessage = container.querySelector('.fileInfoEmpty') as Element;
  let list = container.querySelector('.fileInfoList') as Element;
  let listItemTemplate = list.querySelector('[data-template]') as HTMLTemplateElement;
  let errorStatus = container.querySelector('.statusBarMessage[data-status="error"]') as Element;

  let onInputChange: (e: Event) => void | undefined;

  input.addEventListener('change', (e) => {
    onInputChange?.(e);
  });

  let controller: ViewController = {
    addFileInfo: (info) => {
      let templateParts = {
        '[data-template-file-caption]': info.name,
        '[data-template-file-size]': prettyBytes(info.byteSize),
        '[data-template-file-hash]': info.hash,
        '[data-template-hash-timing]': `${info.hashDurationMs.toFixed(1)} ms`,
      };

      let template = listItemTemplate.content.cloneNode(true) as Element;

      for (let [ selector, value ] of Object.entries(templateParts)) {
        let node = template.querySelector(selector);

        if (node) {
          node.textContent = value;
        }
      }

      let container = list.parentElement as Element;
      container.scroll({ top: 0 });

      if (!infoEmptyMessage.hasAttribute('data-hidden')) {
        infoEmptyMessage.setAttribute('data-hidden', 'true');
      }

      list.prepend(template);
    },

    error: (error) => {
      errorStatus.textContent = `error - ${error.message}`;
      console.error(error);
    },

    status: (value) => {
      if (value === 'ready') {
        input.removeAttribute('disabled');
      } else {
        input.setAttribute('disabled', 'true');
      }

      document.documentElement.setAttribute('data-status', value);
    },
  };

  return {
    setOnInputChange: (callback: (e: Event) => void) => {
      onInputChange = callback;
    },

    update: (props: Partial<ViewProps>) => {
      for (let [ key, value ] of Object.entries(props)) {
        // @ts-expect-error: Technically `key` could be any string but we don't
        // really care in this case.
        controller[key]?.(value);
      }
    },
  };
}

async function onInputChange({
  event,
  hasher,
  update,
}: OnInputChangeProps) {
  let input = event.target as HTMLInputElement;

  if (!input.files?.length) {
    return;
  }

  // In general, hashing files happens very quickly and the status changes from
  // "processing" to "ready" so quickly that it looks janky. This is far from
  // perfect, but the idea is that if the timeout hasn't been cleared within a
  // quarter of a second, assume that a very large file or number of files is
  // being processed and will take some time. In that case, update the status.
  let statusTimeout = setTimeout(() => {
    update({ status: 'processing' });
  }, 250);

  for (let file of input.files) {
    try {
      let start = performance.now();
      let hash = await hasher.hash(file);
      let end = performance.now();

      update({
        addFileInfo: {
          byteSize: file.size,
          hash,
          hashDurationMs: end - start,
          name: file.name,
        },
      });
    } catch (error) {
      clearTimeout(statusTimeout);
      update({ status: 'error', error: error as Error });
      return;
    }
  }

  clearTimeout(statusTimeout);
  update({ status: 'ready' });
}

// -- Types -------------------------------------------------------------------

interface FileInfo {
  byteSize: number;
  hash: string;
  hashDurationMs: number;
  name: string;
}

interface ViewProps {
  addFileInfo: FileInfo;
  error: Error;
  status: "disabled" | "error" | "processing" | "ready";
}

type ViewController = { [K in keyof ViewProps]: (value: ViewProps[K]) => void };

interface OnInputChangeProps {
  event: Event;
  hasher: FileHasher;
  update: ReturnType<typeof initView>["update"];
}
