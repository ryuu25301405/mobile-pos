'use client';

import { useEffect, useRef } from 'react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  isPaused: boolean;
}

export default function Scanner({ onScan, isPaused }: ScannerProps) {
  const isMounted = useRef(true);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    isMounted.current = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!isMounted.current) return;

      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {}
        )
        .catch((err: any) => {
          console.error('Camera startup error:', err);
        });
    });

    return () => {
      isMounted.current = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current.clear())
          .catch((err: any) => console.error(err));
      }
    };
  }, []);

  // Handle pausing/resuming scanner without re-requesting permissions
  useEffect(() => {
    if (!scannerRef.current) return;

    if (isPaused) {
      scannerRef.current.pause(true);
    } else {
      try {
        scannerRef.current.resume();
      } catch (e) {
        // Handle case where scanner wasn't fully running yet
      }
    }
  }, [isPaused]);

  return <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-lg"></div>;
}