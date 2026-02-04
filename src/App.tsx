import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Toaster } from '@/components/ui/sonner';
import Navigation from './sections/Navigation';
import Hero from './sections/Hero';
import LogoTicker from './sections/LogoTicker';
import Features from './sections/Features';
import Process from './sections/Process';
import OutputFormats from './sections/OutputFormats';
import Testimonials from './sections/Testimonials';
import TryIt from './sections/TryIt';
import CTA from './sections/CTA';
import Footer from './sections/Footer';

gsap.registerPlugin(ScrollTrigger);

function App() {
  useEffect(() => {
    // Initialize scroll animations
    const ctx = gsap.context(() => {
      // Refresh ScrollTrigger on load
      ScrollTrigger.refresh();
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white overflow-x-hidden">
      <Navigation />
      <Hero />
      <LogoTicker />
      <Features />
      <Process />
      <OutputFormats />
      <Testimonials />
      <TryIt />
      <CTA />
      <Footer />
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;
