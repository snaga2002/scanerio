import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, FileText, GitBranch, AlertTriangle, Plug, Users } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Features = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        '.features-heading',
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

      // Cards 3D flip animation
      gsap.fromTo(
        '.feature-card',
        { rotateX: 90, y: 100, opacity: 0 },
        {
          rotateX: 0,
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.features-grid',
            start: 'top 70%',
          },
        }
      );

      // Parallax effect for cards
      const cards = document.querySelectorAll('.feature-card');
      cards.forEach((card, index) => {
        const speed = index % 2 === 0 ? -50 : -20;
        gsap.to(card, {
          y: speed,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const features = [
    {
      icon: Sparkles,
      title: 'AI Test Generation',
      description: 'Automatically generate comprehensive test cases from your Figma designs using advanced AI analysis.',
      image: '/feature-1.jpg',
    },
    {
      icon: FileText,
      title: 'User Stories',
      description: 'Create detailed user stories with acceptance criteria based on design components and interactions.',
      image: '/feature-2.jpg',
    },
    {
      icon: GitBranch,
      title: 'Test Scenarios',
      description: 'Generate end-to-end test scenarios that cover all user flows and interaction patterns.',
      image: '/feature-3.jpg',
    },
    {
      icon: AlertTriangle,
      title: 'Edge Case Detection',
      description: 'Identify boundary conditions and potential error states that might be missed manually.',
      image: '/feature-4.jpg',
    },
    {
      icon: Plug,
      title: 'Seamless Integrations',
      description: 'Connect with Jira, GitHub, Slack, and your existing workflow tools effortlessly.',
      image: '/feature-5.jpg',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Share test cases, add comments, and collaborate with your team in real-time.',
      image: '/feature-6.jpg',
    },
  ];

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="features-heading text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Accelerate Your{' '}
            <span className="text-gradient">Product Delivery</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            From design to deployment, our AI streamlines every step of your testing workflow
          </p>
        </div>

        {/* Features Grid */}
        <div
          className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          style={{ perspective: '1000px' }}
        >
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  image: string;
  index: number;
}

const FeatureCard = ({ icon: Icon, title, description, image }: FeatureCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;

    gsap.to(card, {
      rotateX,
      rotateY,
      duration: 0.3,
      ease: 'power2.out',
    });

    // Move glare
    const glare = card.querySelector('.card-glare') as HTMLElement;
    if (glare) {
      glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(126, 110, 227, 0.15), transparent 50%)`;
    }
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    gsap.to(card, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.5,
      ease: 'power2.out',
    });

    const glare = card.querySelector('.card-glare') as HTMLElement;
    if (glare) {
      glare.style.background = 'transparent';
    }
  };

  return (
    <div
      ref={cardRef}
      className="feature-card group relative bg-[#181818] rounded-2xl overflow-hidden border border-white/5 hover:border-[#7e6ee3]/30 transition-all duration-500 hover:scale-[1.02]"
      style={{
        transformStyle: 'preserve-3d',
        transformOrigin: 'center center',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glare overlay */}
      <div className="card-glare absolute inset-0 pointer-events-none z-10 transition-opacity duration-300" />

      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative p-6">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#7e6ee3]/10 flex items-center justify-center mb-4 group-hover:bg-[#7e6ee3]/20 transition-colors">
          <Icon className="w-6 h-6 text-[#7e6ee3]" />
        </div>

        <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-[#7e6ee3] transition-colors">
          {title}
        </h3>
        <p className="text-white/60 text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Animated border */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl border border-[#7e6ee3]/50" 
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(126, 110, 227, 0.1), transparent)',
            backgroundSize: '200% 100%',
            animation: 'gradient-shift 3s linear infinite',
          }}
        />
      </div>
    </div>
  );
};

export default Features;
