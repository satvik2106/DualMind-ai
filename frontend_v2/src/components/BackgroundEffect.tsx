'use client';

import { motion } from 'framer-motion';

export default function BackgroundEffect() {
  return (
    <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
      {/* Base deep space gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background-secondary via-background to-background" />

      {/* Floating neon orbs */}
      <motion.div
        animate={{
          x: [0, 100, -100, 0],
          y: [0, 50, -50, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-cyan/10 rounded-full blur-[120px]"
      />

      <motion.div
        animate={{
          x: [0, -150, 100, 0],
          y: [0, -100, 100, 0],
          scale: [1, 1.5, 0.9, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-accent-purple/10 rounded-full blur-[150px]"
      />

      <motion.div
        animate={{
          x: [0, 50, -50, 0],
          y: [0, -150, 50, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-1/2 left-1/2 w-80 h-80 bg-accent-deep-purple/15 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Subtle grid overlay for tech feel */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwem0yMCAyMGgyMHYyMEgyMHptLTIwIDBoMjB2MjBIMHpNMjAgMGgyMHYyMEgyMHoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-20 mask-image:linear-gradient(to_bottom,black,transparent)]" />
    </div>
  );
}
