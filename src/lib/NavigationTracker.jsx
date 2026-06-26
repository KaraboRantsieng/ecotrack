import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
  const location = useLocation();

  // Notify any parent window embedding the app about URL changes
  useEffect(() => {
    window.parent?.postMessage({ type: 'app_changed_url', url: window.location.href }, '*');
  }, [location]);

  return null;
}
