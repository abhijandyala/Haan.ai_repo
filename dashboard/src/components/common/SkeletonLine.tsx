interface SkeletonLineProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export default function SkeletonLine({
  width = '100%',
  height = '12px',
  borderRadius = 'var(--radius-sm)',
}: SkeletonLineProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius }}
    />
  );
}
