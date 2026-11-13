export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

export interface FilePorts {
  pick(accept: string): Promise<PickedFile | null>;
  save(name: string, bytes: Uint8Array, mime: string): void;
}

export function createDomFilePorts(page?: Document): FilePorts {
  return {
    pick(accept) {
      return new Promise((resolve, reject) => {
        const doc = page ?? document;
        const input = doc.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.style.display = "none";
        const done = (): void => input.remove();
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (!file) {
            done();
            resolve(null);
            return;
          }
          file.arrayBuffer().then(
            (buffer) => {
              done();
              resolve({ name: file.name, bytes: new Uint8Array(buffer) });
            },
            (error: unknown) => {
              done();
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          );
        });
        input.addEventListener("cancel", () => {
          done();
          resolve(null);
        });
        doc.body.appendChild(input);
        input.click();
      });
    },
    save(name, bytes, mime) {
      const doc = page ?? document;
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
      const link = doc.createElement("a");
      link.href = url;
      link.download = name;
      link.style.display = "none";
      doc.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };
}
