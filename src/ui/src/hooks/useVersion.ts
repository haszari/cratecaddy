import { useQuery } from '@tanstack/react-query';

export interface VersionInfo {
  appVersion: string;
  version: string;
  gitCommitShort: string;
  gitCommit: string;
  gitBranch: string;
  gitDirty: boolean;
}

async function fetchVersion(): Promise<VersionInfo> {
  const res = await fetch('/api/version');
  if (!res.ok) {
    throw new Error(`Failed to fetch version: ${res.statusText}`);
  }
  return res.json();
}

export function useVersion() {
  return useQuery<VersionInfo>({
    queryKey: ['version'],
    queryFn: fetchVersion,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
