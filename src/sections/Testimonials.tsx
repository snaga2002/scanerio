import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const Testimonials = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading animation
      gsap.fromTo(
        '.testimonials-heading',
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
        '.testimonial-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.testimonials-carousel',
            start: 'top 70%',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (isDragging) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isDragging]);

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'QA Lead at TechCorp',
      avatar: '/avatar-1.jpg',
      content: 'Figma-to-Test has completely transformed our testing workflow. What used to take days now takes minutes. The AI understands our designs better than we expected.',
      rating: 5,
    },
    {
      name: 'Michael Rodriguez',
      role: 'Product Manager at StartupX',
      avatar: '/avatar-2.jpg',
      content: 'The edge case detection alone has saved us countless hours of debugging. It catches scenarios we would have never thought of. Absolutely game-changing.',
      rating: 5,
    },
    {
      name: 'Emily Watson',
      role: 'Engineering Director at ScaleUp',
      avatar: '/avatar-3.jpg',
      content: 'Integration with Jira was seamless. Our QA team now gets comprehensive test cases automatically generated from design handoffs. Highly recommend!',
      rating: 5,
    },
  ];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(clientX);
  };

  const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = startX - clientX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="py-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="testimonials-heading text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Loved by <span className="text-gradient">Product Teams</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            See what industry professionals are saying about Figma-to-Test
          </p>
        </div>

        {/* Carousel */}
        <div
          ref={carouselRef}
          className="testimonials-carousel relative"
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => isDragging && handleDragEnd({ clientX: startX } as React.MouseEvent)}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
        >
          <div className="flex items-center justify-center gap-6 perspective-1000">
            {testimonials.map((testimonial, index) => {
              const offset = index - activeIndex;
              const isActive = index === activeIndex;
              
              return (
                <TestimonialCard
                  key={index}
                  {...testimonial}
                  offset={offset}
                  isActive={isActive}
                />
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="border-white/20 text-white hover:bg-white/10 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'w-8 bg-[#7e6ee3]'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="border-white/20 text-white hover:bg-white/10 rounded-full"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

interface TestimonialCardProps {
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  offset: number;
  isActive: boolean;
}

const TestimonialCard = ({ name, role, avatar, content, rating, offset, isActive }: TestimonialCardProps) => {
  const getTransform = () => {
    if (Math.abs(offset) > 1) return 'scale(0.6) translateX(0)';
    
    const translateX = offset * 120;
    const scale = isActive ? 1 : 0.85;
    const rotateY = offset * -15;
    
    return `translateX(${translateX}%) scale(${scale}) rotateY(${rotateY}deg)`;
  };

  return (
    <div
      className={`testimonial-card absolute w-full max-w-lg transition-all duration-500 cursor-grab active:cursor-grabbing ${
        isActive ? 'z-20' : Math.abs(offset) === 1 ? 'z-10' : 'z-0'
      }`}
      style={{
        transform: getTransform(),
        opacity: Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.5,
        filter: isActive ? 'none' : 'blur(2px)',
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <div className="bg-[#181818] rounded-2xl p-8 border border-white/5 shadow-xl">
        {/* Quote icon */}
        <Quote className="w-10 h-10 text-[#7e6ee3]/30 mb-4" />
        
        {/* Content */}
        <p className="text-white/80 text-lg leading-relaxed mb-6">
          "{content}"
        </p>
        
        {/* Rating */}
        <div className="flex gap-1 mb-6">
          {Array.from({ length: rating }).map((_, i) => (
            <svg
              key={i}
              className="w-5 h-5 text-[#7e6ee3]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        
        {/* Author */}
        <div className="flex items-center gap-4">
          <img
            src={avatar}
            alt={name}
            className="w-12 h-12 rounded-full object-cover border-2 border-[#7e6ee3]/30"
          />
          <div>
            <h4 className="font-semibold text-white">{name}</h4>
            <p className="text-white/50 text-sm">{role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;
