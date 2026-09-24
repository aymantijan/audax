import { useMemo } from 'react';
import { useCareerStore } from '../store/careerStore';
import { useNetworkingStore } from '../store/networkingStore';
import { useContentStore } from '../store/contentStore';
import { DEFAULT_CAREER_DOMAINS, domainLabel } from '../utils/constants';

/**
 * Career domains for selects/filters: the user's list (or the defaults) plus
 * every value already used by an application, contact or post, so older
 * data (e.g. "PE", "General") keeps showing. → [{ value, label }]
 */
export function useCareerDomains() {
  const custom = useCareerStore((s) => s.domains);
  const apps = useCareerStore((s) => s.applications);
  const contacts = useNetworkingStore((s) => s.contacts);
  const posts = useContentStore((s) => s.posts);
  return useMemo(() => {
    const base = custom?.length ? custom : DEFAULT_CAREER_DOMAINS;
    const used = [...apps, ...contacts, ...posts].map((x) => x.domain).filter(Boolean);
    return [...new Set([...base, ...used])].map((d) => ({ value: d, label: domainLabel(d) }));
  }, [custom, apps, contacts, posts]);
}
