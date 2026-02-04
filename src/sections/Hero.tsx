import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation - split word reveal
      gsap.fromTo(
        '.hero-heading-word',
        { y: 100, opacity: 0, rotateX: 90 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 1,
          stagger: 0.1,
          ease: 'power3.out',
          delay: 0.2,
        }
      );

      // Subheading fade up
      gsap.fromTo(
        '.hero-subheading',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.5 }
      );

      // Buttons elastic pop
      gsap.fromTo(
        '.hero-btn',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'back.out(1.7)',
          delay: 0.7,
        }
      );

      // Dashboard 3D perspective tilt
      gsap.fromTo(
        dashboardRef.current,
        { rotateX: 45, z: -500, opacity: 0 },
        {
          rotateX: 20,
          z: 0,
          opacity: 1,
          duration: 1.5,
          ease: 'power3.out',
          delay: 0.8,
        }
      );

      // Scroll-based parallax for dashboard
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          if (dashboardRef.current) {
            gsap.to(dashboardRef.current, {
              y: self.progress * 100,
              rotateX: 20 - self.progress * 20,
              duration: 0.1,
            });
          }
        },
      });

      // Heading blur out on scroll
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'top top',
        end: '50% top',
        scrub: true,
        onUpdate: (self) => {
          if (headingRef.current) {
            gsap.to(headingRef.current, {
              filter: `blur(${self.progress * 10}px)`,
              opacity: 1 - self.progress,
              duration: 0.1,
            });
          }
        },
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Mouse-based 3D tilt effect for dashboard
  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = dashboard.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;

      const rotateY = (mouseX / rect.width) * 5;
      const rotateX = -(mouseY / rect.height) * 5 + 20;

      gsap.to(dashboard, {
        rotateY,
        rotateX,
        duration: 0.5,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(dashboard, {
        rotateY: 0,
        rotateX: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    dashboard.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      dashboard.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const headingWords = ['Figma', 'designs', 'to', 'test', 'cases', 'in', 'seconds'];

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Neural Mesh Background */}
      <div className="absolute inset-0 overflow-hidden">
        <canvas
          id="neural-canvas"
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.3 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0e0e0e]/50 to-[#0e0e0e]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="hero-subheading inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#7e6ee3] animate-pulse" />
          <span className="text-sm text-white/70">AI-Powered Test Generation</span>
        </div>

        {/* Heading */}
        <h1
          ref={headingRef}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 perspective-1000"
        >
          <span className="overflow-hidden inline-block">
            {headingWords.map((word, index) => (
              <span
                key={index}
                className={`hero-heading-word inline-block mr-2 sm:mr-4 ${
                  index === 0 || index === 3 || index === 4 ? 'text-gradient' : 'text-white'
                }`}
              >
                {word}
              </span>
            ))}
          </span>
        </h1>

        {/* Subheading */}
        <p className="hero-subheading text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10">
          AI-powered test generation that understands your designs. Create comprehensive
          user stories, test scenarios, and edge cases automatically.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#try-it">
            <Button
              size="lg"
              className="hero-btn bg-[#7e6ee3] hover:bg-[#6b5dd3] text-white px-8 py-6 rounded-full font-medium text-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(126,110,227,0.5)] group"
            >
              Try It Now
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
          <a href="#features">
            <Button
              size="lg"
              variant="outline"
              className="hero-btn border-white/20 text-white hover:bg-white/10 px-8 py-6 rounded-full font-medium text-lg group"
            >
              <Play className="mr-2 w-5 h-5 group-hover:scale-110 transition-transform" />
              Learn More
            </Button>
          </a>
        </div>

        {/* Dashboard Preview */}
        <div
          ref={dashboardRef}
          className="relative mx-auto max-w-4xl"
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <img
              src="/hero-dashboard.jpg"
              alt="Figma-to-Test Dashboard"
              className="w-full h-auto"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/80 via-transparent to-transparent" />
          </div>
          
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-[#7e6ee3]/20 blur-3xl -z-10 rounded-full" />
        </div>
      </div>

      {/* Neural Canvas Script */}
      <NeuralCanvas />
    </section>
  );
};

// Neural Mesh Background Component
const NeuralCanvas = () => {
  useEffect(() => {
    const canvas = document.getElementById('neural-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 25000);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(126, 110, 227, ${0.2 * (1 - distance / 150)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(126, 110, 227, 0.6)';
        ctx.fill();

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return null;
};

export default Hero;
