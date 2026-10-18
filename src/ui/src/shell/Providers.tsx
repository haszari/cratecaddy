import { MantineProvider } from '@mantine/core';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import theme from '../styles/theme';
import { mantineTheme } from '../styles/mantineTheme';
import { queryClient } from '../lib/queryClient';
import '../App.scss';

/**
 * Providers shared by both build targets.
 *
 * Keep this free of router and data-source choices: the API shell and the
 * static shell each wrap this with their own router and data module.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={mantineTheme} forceColorScheme="dark">
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </MantineProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
