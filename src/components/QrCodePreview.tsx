import { useMemo } from 'react';
import { QrCode } from 'lucide-react';
import { generateDeterministicQrMatrix } from '../utils/aureliaLogic';

interface QrCodePreviewProps {
  payload: string;
  imageDataUrl?: string;
  label?: string;
  size?: number;
}

export function QrCodePreview({
  payload,
  imageDataUrl,
  label = 'Linked Payout QR',
  size = 112,
}: QrCodePreviewProps) {
  const effectivePayload = payload.trim() || 'upi://pay?pa=aurelia.driver@okicici&cu=INR';
  const matrix = useMemo(() => generateDeterministicQrMatrix(effectivePayload, 21), [effectivePayload]);

  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    return (
      <div className="inline-flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white border border-stone-200 dark:border-white/15 shadow-sm">
        <img
          src={imageDataUrl}
          alt={label}
          referrerPolicy="no-referrer"
          style={{ width: size, height: size }}
          className="object-contain rounded-lg"
        />
        <span className="text-[10px] font-mono-tabular font-semibold text-stone-700 truncate max-w-[140px]">
          {label}
        </span>
      </div>
    );
  }

  const cells = matrix.length;
  return (
    <div className="inline-flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${cells} ${cells}`}
        role="img"
        aria-label={label}
        className="rounded-md"
      >
        <rect x={0} y={0} width={cells} height={cells} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((on, c) =>
            on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#111827" /> : null
          )
        )}
      </svg>
      <span className="text-[10px] font-mono-tabular font-semibold text-stone-700 flex items-center gap-1 max-w-[140px] truncate">
        <QrCode className="w-3 h-3 shrink-0 text-[#9A722A]" />
        <span className="truncate">{label}</span>
      </span>
    </div>
  );
}
