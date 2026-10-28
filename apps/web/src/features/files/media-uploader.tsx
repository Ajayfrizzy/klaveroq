"use client";

import { ImagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUploadsEnabled, UploadsUnavailable } from "./upload-availability";
import { uploadFormData } from "./upload";

type Media = { url: string; altText: string; contentType: string };

export function MediaUploader({
  endpoint,
  label,
  accept,
  altRequired = false,
  initialMedia,
  onChange,
  onPreview,
}: {
  endpoint: string;
  label: string;
  accept: string;
  altRequired?: boolean;
  initialMedia: Media | null;
  onChange: (media: Media | null) => void;
  onPreview?: (url: string | null) => void;
}) {
  const uploadsEnabled = useUploadsEnabled();
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState(initialMedia?.altText ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function upload() {
    if (!uploadsEnabled || !file) return;
    setBusy(true);
    setError("");
    setProgress(0);
    controller.current = new AbortController();
    const form = new FormData();
    form.set("file", file);
    form.set("altText", altText);
    try {
      const media = await uploadFormData<Media>(
        endpoint,
        form,
        controller.current.signal,
        setProgress,
      );
      onChange(media);
      onPreview?.(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file could not be uploaded.");
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "The media could not be removed.");
      }
      onChange(null);
      setAltText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The media could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  if (!uploadsEnabled) return <UploadsUnavailable />;

  return (
    <div className="media-uploader">
      <label className="file-picker">
        <ImagePlus size={15} />
        <span>{initialMedia ? `Replace ${label}` : `Choose ${label}`}</span>
        <input
          ref={fileInput}
          aria-label={initialMedia ? `Replace ${label}` : `Choose ${label}`}
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            const url = selected?.type.startsWith("image/") ? URL.createObjectURL(selected) : null;
            setPreview(url);
            onPreview?.(url);
            setError("");
          }}
        />
      </label>
      {file?.type.startsWith("image/") && preview && (
        <figure className="upload-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {!onPreview && <img src={preview} alt={`Selected ${label} preview`} />}
          <figcaption>Preview only — select Upload to save this image.</figcaption>
        </figure>
      )}
      {(file || initialMedia) && (
        <label>
          Alternative text
          <input
            required={altRequired}
            maxLength={500}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder={altRequired ? "Describe the media" : "Optional image description"}
          />
        </label>
      )}
      {file && (
        <div className="media-upload-actions">
          <span>{file.name}</span>
          {busy ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              <X size={14} /> Cancel
            </button>
          ) : (
            <button
              className="secondary-button"
              type="button"
              disabled={altRequired && altText.trim().length < 3}
              onClick={upload}
            >
              {error ? <RotateCcw size={14} /> : <ImagePlus size={14} />}{" "}
              {error ? "Retry" : "Upload"}
            </button>
          )}
        </div>
      )}
      {progress !== null && (
        <div
          className="upload-progress"
          role="progressbar"
          aria-label={`${label} upload progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
          <small>{progress}%</small>
        </div>
      )}
      {initialMedia && !file && (
        <button className="danger-text media-remove" type="button" disabled={busy} onClick={remove}>
          <Trash2 size={14} /> Remove {label}
        </button>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
