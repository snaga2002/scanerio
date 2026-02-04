import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Upload, Brain, FileCheck } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Process = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        '.process-heading',
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

      // SVG path drawing animation
      if (pathRef.current) {
        const pathLength = pathRef.current.getTotalLength();
        gsap.set(pathRef.current, {
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength,
        });

        gsap.to(pathRef.current, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            end: 'bottom 80%',
            scrub: 1,
          },
        });
      }

      // Step cards animation
      gsap.fromTo(
        '.process-step',
        { scale: 0.8, opacity: 0, clipPath: 'circle(0% at 50% 50%)' },
        {
          scale: 1,
          opacity: 1,
          clipPath: 'circle(100% at 50% 50%)',
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.process-steps',
            start: 'top 70%',
          },
        }
      );

      // Step numbers animation
      gsap.fromTo(
        '.step-number',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.2,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: '.process-steps',
            start: 'top 70%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const steps = [
    {
      number: '01',
      icon: Upload,
      title: 'Upload Your Designs',
      description: 'Connect your Figma account or upload design files directly. Our system supports all major design formats and automatically extracts design components.',
      image: '/process-1.jpg',
    },
    {
      number: '02',
      icon: Brain,
      title: 'AI Analysis',
      description: 'Our transformer-based AI model analyzes your screens, identifies user flows, and understands design patterns to generate comprehensive test coverage.',
      image: '/process-2.jpg',
    },
    {
      number: '03',
      icon: FileCheck,
      title: 'Generate Test Cases',
      description: 'Receive detailed user stories, test scenarios, and edge cases. Export in your preferred format and integrate directly with your testing workflow.',
      image: '/process-3.jpg',
    },
  ];

  return (
    <section
      id="process"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Background SVG Path */}
      <svg
        className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 hidden lg:block"
        viewBox="0 0 4 800"
        preserveAspectRatio="none"
      >
        <path
          ref={pathRef}
          d="M2 0 L2 800"
          stroke="url(#gradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7e6ee3" stopOpacity="0" />
            <stop offset="20%" stopColor="#7e6ee3" stopOpacity="1" />
            <stop offset="80%" stopColor="#7e6ee3" stopOpacity="1" />
            <stop offset="100%" stopColor="#7e6ee3" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="process-heading text-center mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Three simple steps to transform your designs into comprehensive test coverage
          </p>
        </div>

        {/* Steps */}
        <div className="process-steps space-y-24 lg:space-y-32">
          {steps.map((step, index) => (
            <ProcessStep
              key={index}
              {...step}
              isReversed={index % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface ProcessStepProps {
  number: string;
  icon: React.ElementType;
  title: string;
  description: string;
  image: string;
  isReversed: boolean;
}

const ProcessStep = ({ number, icon: Icon, title, description, image, isReversed }: ProcessStepProps) => {
  return (
    <div
      className={`process-step flex flex-col ${
        isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
      } items-center gap-12 lg:gap-20`}
    >
      {/* Content */}
      <div className={`flex-1 ${isReversed ? 'lg:text-right' : 'lg:text-left'}`}>
        <div className={`flex items-center gap-4 mb-6 ${isReversed ? 'lg:justify-end' : ''}`}>
          <span className="step-number w-14 h-14 rounded-full bg-[#7e6ee3] flex items-center justify-center text-white font-bold text-lg">
            {number}
          </span>
          <div className="w-12 h-12 rounded-xl bg-[#7e6ee3]/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-[#7e6ee3]" />
          </div>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-white">{title}</h3>
        <p className="text-white/60 text-lg leading-relaxed max-w-lg">
          {description}
        </p>
      </div>

      {/* Image */}
      <div className="flex-1 relative">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
          <img
            src={image}
            alt={title}
            className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/60 via-transparent to-transparent" />
        </div>
        {/* Glow effect */}
        <div className="absolute -inset-4 bg-[#7e6ee3]/10 blur-3xl -z-10 rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

export default Process;
