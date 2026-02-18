import { motion } from 'framer-motion';

export default function StreamingIndicator() {
  return (
    <span style={{
      display: 'inline-flex',
      gap: 3,
      marginLeft: 4,
      alignItems: 'center',
      verticalAlign: 'middle',
    }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}
