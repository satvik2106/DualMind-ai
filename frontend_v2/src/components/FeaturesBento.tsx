'use client';

import { motion } from 'framer-motion';
import { Sparkles, Database, Code, RefreshCcw } from 'lucide-react';

const features = [
  {
    title: "Autonomous Workflows",
    description: "Agents plan, verify, and self-correct without human intervention.",
    icon: RefreshCcw,
    colSpan: "col-span-1 md:col-span-2",
    bg: "from-accent-cyan/20 to-transparent",
    border: "group-hover:border-accent-cyan/50"
  },
  {
    title: "Live Research",
    description: "Real-time access to ArXiv, Wikipedia, and global news feeds.",
    icon: Database,
    colSpan: "col-span-1",
    bg: "from-accent-purple/20 to-transparent",
    border: "group-hover:border-accent-purple/50"
  },
  {
    title: "Code Execution",
    description: "Write, test, and deploy code within secure sandboxed environments.",
    icon: Code,
    colSpan: "col-span-1",
    bg: "from-accent-deep-purple/20 to-transparent",
    border: "group-hover:border-accent-deep-purple/50"
  },
  {
    title: "Reasoning Engine",
    description: "Advanced cognitive architecture powered by NVIDIA Mistral-Nemotron.",
    icon: Sparkles,
    colSpan: "col-span-1 md:col-span-2",
    bg: "from-accent-blue/20 to-transparent",
    border: "group-hover:border-accent-blue/50"
  },
];

export default function FeaturesBento() {
  return (
    <section id="features" className="py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Engineered for <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-blue">Excellence</span></h2>
          <p className="text-xl text-foreground-muted max-w-2xl">
            A complete suite of tools designed to augment human intelligence with autonomous capabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`glass-panel rounded-3xl p-8 relative overflow-hidden group transition-all duration-500 hover:-translate-y-1 ${feature.colSpan} ${feature.border}`}
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-glass-overlay border border-border-glass flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="w-7 h-7 text-foreground" />
                </div>
                
                <div className="mt-auto">
                  <h3 className="text-2xl font-bold mb-3 text-foreground">{feature.title}</h3>
                  <p className="text-foreground-muted text-lg leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
