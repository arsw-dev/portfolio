import { useEffect } from 'react';

const useFadeIn = () => {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-fade]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting)
            return;

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.07, rootMargin: '0px 0px -20px 0px' },
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
};

export { useFadeIn };
