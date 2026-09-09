'use client';

import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ScannerProps {
  onScan: (decodedText: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
      },
      (errorMessage) => {
        // Ignore scan errors while searching
      }
    );

    return () => {
      scanner.clear().catch((error) => console.error('Failed to clear scanner', error));
    };
  }, [onScan]);

  return <div id="reader" className="w-full max-w-md mx-auto"></div>;
}