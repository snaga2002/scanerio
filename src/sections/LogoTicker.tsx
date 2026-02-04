import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const LogoTicker = () => {
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.ticker-container',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: tickerRef.current,
            start: 'top 80%',
          },
        }
      );
    }, tickerRef);

    return () => ctx.revert();
  }, []);

  // Company logos as SVG components
  const logos = [
    { name: 'Stripe', svg: (
      <svg viewBox="0 0 60 25" className="h-6 w-auto fill-current">
        <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a10.09 10.09 0 0 1-4.56 1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02 1.26-.06 1.58zm-6.3-5.63c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3V6.1h4.14v1.05c.94-.73 2.25-1.37 3.8-1.37v3.8c-.24-.04-.51-.08-.83-.08-.98 0-2.23.36-2.97 1.2v9.6h-4.14zm-5.78-14.2v14.2h-4.1v-1.33c-.94.98-2.35 1.64-3.84 1.64-3.01 0-5.58-2.55-5.58-7.44 0-4.71 2.53-7.56 5.58-7.56 1.45 0 2.86.62 3.84 1.64V6.1h4.1zm-4.1 7.07c0-2.55-1.14-3.72-2.74-3.72-1.6 0-2.74 1.17-2.74 3.72 0 2.55 1.14 3.72 2.74 3.72 1.6 0 2.74-1.17 2.74-3.72zM15.97 6.1v14.2h-4.1v-1.33c-.94.98-2.35 1.64-3.84 1.64-3.01 0-5.58-2.55-5.58-7.44 0-4.71 2.53-7.56 5.58-7.56 1.45 0 2.86.62 3.84 1.64V6.1h4.1zm-4.1 7.07c0-2.55-1.14-3.72-2.74-3.72-1.6 0-2.74 1.17-2.74 3.72 0 2.55 1.14 3.72 2.74 3.72 1.6 0 2.74-1.17 2.74-3.72z"/>
      </svg>
    )},
    { name: 'Notion', svg: (
      <svg viewBox="0 0 100 25" className="h-6 w-auto fill-current">
        <path d="M8.5 3.5L2 6v15l6.5 2.5L15 21l6.5 2.5 6.5-2.5V6l-6.5-2.5L15 6 8.5 3.5zm6.5 15V9l6.5-2.5v9.5L15 18.5zM8.5 9v9.5l6.5 2.5V11.5L8.5 9zM28 8h3v12h-3V8zm1.5-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM35 8h3v2h.1c.6-1.2 2-2.3 3.9-2.3 2.7 0 4.5 1.8 4.5 4.8V20h-3v-4.8c0-1.8-.9-2.7-2.3-2.7-1.5 0-2.7 1.1-2.7 2.9V20h-3V8h.5zm18 0h3v2h.1c.6-1.2 2-2.3 3.9-2.3 2.7 0 4.5 1.8 4.5 4.8V20h-3v-4.8c0-1.8-.9-2.7-2.3-2.7-1.5 0-2.7 1.1-2.7 2.9V20h-3V8h.5zm18 0h3v12h-3V8zm1.5-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM78 8h3v2h.1c.6-1.2 2-2.3 3.9-2.3 2.7 0 4.5 1.8 4.5 4.8V20h-3v-4.8c0-1.8-.9-2.7-2.3-2.7-1.5 0-2.7 1.1-2.7 2.9V20h-3V8zm18 0h3v12h-3V8zm1.5-5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>
      </svg>
    )},
    { name: 'Slack', svg: (
      <svg viewBox="0 0 60 25" className="h-6 w-auto fill-current">
        <path d="M22.5 11.25a2.5 2.5 0 0 1-2.5 2.5h-2.5v-2.5a2.5 2.5 0 1 1 5 0zm-2.5 3.75h2.5v2.5a2.5 2.5 0 1 1-2.5-2.5zm-5-3.75a2.5 2.5 0 0 0 2.5 2.5h2.5v-2.5a2.5 2.5 0 1 0-5 0zm2.5 3.75h-2.5v2.5a2.5 2.5 0 1 0 2.5-2.5zm5-10h-2.5v2.5a2.5 2.5 0 1 0 2.5-2.5zm-5 0a2.5 2.5 0 0 0-2.5 2.5v2.5h2.5a2.5 2.5 0 1 0 0-5zM5 8.75a2.5 2.5 0 1 0 2.5 2.5v-2.5H5zm0 3.75v2.5a2.5 2.5 0 1 0 2.5-2.5H5z"/>
      </svg>
    )},
    { name: 'Figma', svg: (
      <svg viewBox="0 0 40 25" className="h-6 w-auto fill-current">
        <path d="M8.5 2a5 5 0 0 0 0 10h5V2h-5zm5 10h-5a5 5 0 0 0 0 10 5 5 0 0 0 5-5v-5zm5-10a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 10a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
      </svg>
    )},
    { name: 'GitHub', svg: (
      <svg viewBox="0 0 30 25" className="h-6 w-auto fill-current">
        <path d="M15 2.5C8.1 2.5 2.5 8.1 2.5 15c0 5.5 3.6 10.2 8.5 11.9.6.1.9-.3.9-.6v-2.1c-3.5.8-4.2-1.7-4.2-1.7-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.8-.3-5.7-1.4-5.7-6.2 0-1.4.5-2.5 1.3-3.4-.1-.3-.6-1.6.1-3.4 0 0 1-.3 3.3 1.3a11.5 11.5 0 0 1 6 0c2.3-1.6 3.3-1.3 3.3-1.3.7 1.8.3 3.1.1 3.4.8.9 1.3 2 1.3 3.4 0 4.8-2.9 5.9-5.7 6.2.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.9.6 4.9-1.7 8.5-6.4 8.5-11.9 0-6.9-5.6-12.5-12.5-12.5z"/>
      </svg>
    )},
  ];

  return (
    <section ref={tickerRef} className="py-16 overflow-hidden">
      <div className="ticker-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-white/40 text-sm mb-8 uppercase tracking-wider">
          Trusted by teams at
        </p>
        
        <div className="relative">
          {/* Gradient masks */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0e0e0e] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0e0e0e] to-transparent z-10" />
          
          {/* Ticker */}
          <div className="flex overflow-hidden">
            <div className="flex gap-16 animate-slide-infinite hover:[animation-play-state:paused]">
              {[...logos, ...logos, ...logos, ...logos].map((logo, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 text-white/30 hover:text-white/80 transition-all duration-300 hover:scale-110 cursor-pointer"
                >
                  {logo.svg}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LogoTicker;
