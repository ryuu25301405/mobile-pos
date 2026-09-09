'use client';

import { useEffect, useRef } from 'react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let html5QrCode: any = null;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!isMounted.current) return;

      html5QrCode = new Html5Qrcode('reader');

      html5QrCode
        .start(
          { facingMode: 'environment' }, // Uses back camera
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {}
        )
        .catch((err: any) => {
          console.error('Camera access failed:', err);
        });
    });

    return () => {
      isMounted.current = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch((err: any) => console.error(err));
      }
    };
  }, [onScan]);

  return <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-lg"></div>;
}