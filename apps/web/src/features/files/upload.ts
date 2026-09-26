export type UploadResult<T> = { data?: T; error?: { message?: string } };

export function uploadFormData<T>(
  url: string,
  form: FormData,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      const body = request.response as UploadResult<T> | null;
      if (request.status >= 200 && request.status < 300 && body?.data) resolve(body.data);
      else reject(new Error(body?.error?.message ?? "The file could not be uploaded."));
    });
    request.addEventListener("error", () => reject(new Error("The upload connection failed.")));
    request.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled.", "AbortError")),
    );
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(form);
  });
}
