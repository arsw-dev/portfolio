import { Link, linkOptions, useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const sectionLinks = [
  { label: 'experience', link: linkOptions({ to: '/', hash: 'experience' }) },
  { label: 'about', link: linkOptions({ to: '/', hash: 'about' }) },
  { label: 'stack', link: linkOptions({ to: '/', hash: 'stack' }) },
] as const;

const writingLink = linkOptions({ to: '/writing' });

const useNavVisibility = () => {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);
  const suppressRef = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;

      if (!suppressRef.current) {
        if (currentY < window.innerHeight) {
          setVisible(true);
        }
        else {
          setVisible(currentY < lastYRef.current);
        }
      }

      lastYRef.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onNavClick = () => {
    suppressRef.current = true;
    setVisible(true);
    window.addEventListener('scrollend', () => {
      suppressRef.current = false;
    }, { once: true });
  };

  return { visible, onNavClick };
};

const Nav = () => {
  const { visible, onNavClick } = useNavVisibility();
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <nav className={`sticky top-0 z-50 flex h-13 items-center justify-between border-b border-[#131b27] bg-bg/80 backdrop-blur-md px-15 transition-transform duration-300 max-md:px-5.5 ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <Link to="/" className="text-[13px] flex items-center justify-center size-6 tracking-[0.08em] text-text-chrome">as</Link>
      <div className="flex gap-8">
        {sectionLinks.map(({ label, link }) => isHome
          ? (
              <a
                key={label}
                href={`#${link.hash}`}
                onClick={onNavClick}
                className="text-[11px] hidden tracking-widest text-text-chrome transition-colors duration-150 hover:text-accent sm:block"
              >
                {label}
              </a>
            )
          : (
              <Link
                key={label}
                {...link}
                onClick={onNavClick}
                className="text-[11px] hidden tracking-widest text-text-chrome transition-colors duration-150 hover:text-accent sm:block"
              >
                {label}
              </Link>
            ))}
        <Link
          {...writingLink}
          className="text-[11px] tracking-widest transition-colors duration-150 hover:text-accent"
          inactiveProps={{ className: 'text-text-chrome' }}
          activeProps={{ className: 'text-accent' }}
        >
          writing
        </Link>
      </div>
    </nav>
  );
};

export { Nav };
