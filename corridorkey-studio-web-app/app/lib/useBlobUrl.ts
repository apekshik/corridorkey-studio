"use client";

import { useEffect, useState } from "react";

/**
 * Fetch an image URL via fetch() and return a blob URL.
 * This avoids mixed content blocking for <img> tags when
 * an HTTPS page loads images from http://localhost.
 */
export function useBlobUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    let revoke: string | null = null;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        revoke = objUrl;
        setBlobUrl(objUrl);
      })
      .catch(() => {
        setBlobUrl(null);
      });

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url]);

  return blobUrl;
}
