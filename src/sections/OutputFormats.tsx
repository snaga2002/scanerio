import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileText, Table, Code, Layout } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

gsap.registerPlugin(ScrollTrigger);

const OutputFormats = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<typeof formats[0] | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        '.formats-heading',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
          },
        }
      );

      // Cards animation
      gsap.fromTo(
        '.format-card',
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.formats-grid',
            start: 'top 70%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const formats = [
    {
      icon: FileText,
      name: 'Markdown',
      description: 'Human-readable documentation perfect for wikis and README files.',
      image: '/format-markdown.jpg',
      details: {
        features: [
          'Structured test documentation',
          'GitHub-compatible formatting',
          'Easy to edit and maintain',
          'Version control friendly',
        ],
        useCases: ['Documentation', 'Wiki pages', 'GitHub repos', 'Confluence'],
      },
    },
    {
      icon: Table,
      name: 'CSV',
      description: 'Spreadsheet format for easy import into Excel or Google Sheets.',
      image: '/format-csv.jpg',
      details: {
        features: [
          'Tabular data structure',
          'Excel compatible',
          'Easy filtering and sorting',
          'Bulk editing support',
        ],
        useCases: ['Excel analysis', 'Data import', 'Reporting', 'Audits'],
      },
    },
    {
      icon: Code,
      name: 'JSON',
      description: 'Machine-readable format for API integration and automation.',
      image: '/format-json.jpg',
      details: {
        features: [
          'Structured data objects',
          'API integration ready',
          'Custom field mapping',
          'Programmatic access',
        ],
        useCases: ['API integration', 'Automation', 'Custom tools', 'CI/CD pipelines'],
      },
    },
    {
      icon: Layout,
      name: 'Jira',
      description: 'Direct import into Jira for seamless project management.',
      image: '/format-jira.jpg',
      details: {
        features: [
          'Native Jira import',
          'Preserves test structure',
          'Links to requirements',
          'Traceability matrix',
        ],
        useCases: ['Project management', 'Issue tracking', 'Sprint planning', 'QA workflows'],
      },
    },
  ];

  return (
    <section
      id="formats"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="formats-heading text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Export Your <span className="text-gradient">Way</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Seamlessly integrate with your existing workflow. Choose from multiple export formats.
          </p>
        </div>

        {/* Formats Grid */}
        <div className="formats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {formats.map((format, index) => (
            <FormatCard
              key={index}
              {...format}
              onClick={() => setSelectedFormat(format)}
            />
          ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedFormat} onOpenChange={() => setSelectedFormat(null)}>
        <DialogContent className="bg-[#181818] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              {selectedFormat && (
                <>
                  <div className="w-10 h-10 rounded-lg bg-[#7e6ee3]/10 flex items-center justify-center">
                    <selectedFormat.icon className="w-5 h-5 text-[#7e6ee3]" />
                  </div>
                  {selectedFormat.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedFormat && (
            <div className="space-y-6">
              <img
                src={selectedFormat.image}
                alt={selectedFormat.name}
                className="w-full h-48 object-cover rounded-xl"
              />
              <p className="text-white/70">{selectedFormat.description}</p>
              
              <div>
                <h4 className="font-semibold mb-3 text-white">Key Features</h4>
                <ul className="grid grid-cols-2 gap-2">
                  {selectedFormat.details.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7e6ee3]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-white">Best For</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedFormat.details.useCases.map((useCase, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-[#7e6ee3]/10 text-[#7e6ee3] text-sm"
                    >
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

interface FormatCardProps {
  icon: React.ElementType;
  name: string;
  description: string;
  image: string;
  onClick: () => void;
}

const FormatCard = ({ icon: Icon, name, description, image, onClick }: FormatCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="format-card group relative bg-[#181818] rounded-2xl overflow-hidden border border-white/5 hover:border-[#7e6ee3]/30 transition-all duration-500 cursor-pointer"
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/50 to-transparent" />
        
        {/* Icon overlay */}
        <div className="absolute bottom-4 left-4 w-12 h-12 rounded-xl bg-[#7e6ee3] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold mb-2 text-white group-hover:text-[#7e6ee3] transition-colors">
          {name}
        </h3>
        <p className="text-white/60 text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-[#7e6ee3]/5 to-transparent" />
      </div>
    </div>
  );
};

export default OutputFormats;
