"use client";

import { ImagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFormData } from "./upload";

type Media = { url: string; altText: string; contentType: string };

export function MediaUploader({
  endpoint,
  label,
  accept,
  altRequired = false,
  initialMedia,
  onChange,
}: {
  endpoint: string;
  label: string;
  accept: string;
  altRequired?: boolean;
  initialMedia: Media | null;
  onChange: (media: Media | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState(initialMedia?.altText ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  async function upload() {
    if (!file) return;
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
      setFile(null);
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

  return (
    <div className="media-uploader">
      <label className="file-picker">
        <ImagePlus size={15} />
        <span>{initialMedia ? `Replace ${label}` : `Choose ${label}`}</span>
        <input
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
      </label>
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
