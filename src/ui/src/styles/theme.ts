import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif',
    ].join(','),
    fontSize: 13,
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#f8f8f8',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ddd',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#bbb',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
          },
        },
        input: {
          padding: '6px 10px',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          color: '#b0b0b0',
          fontWeight: 500,
          fontSize: '0.7em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          '&.Mui-focused': {
            color: '#b0b0b0',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '6px 10px',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: '1px solid #ddd',
          borderRadius: '4px !important',
          backgroundColor: '#f8f8f8',
          padding: '4px 10px',
          textTransform: 'none',
          fontSize: '0.82em',
          fontWeight: 500,
          color: '#555',
          '&.Mui-selected': {
            backgroundColor: '#e3f2fd',
            borderColor: '#90caf9',
            color: '#1976d2',
            '&:hover': {
              backgroundColor: '#bbdefb',
            },
          },
          '&:hover': {
            backgroundColor: '#f0f0f0',
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 0,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontSize: '0.78em',
        },
        filled: {
          backgroundColor: '#e3f2fd',
        },
        outlined: {
          borderColor: '#ddd',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        tag: {
          borderRadius: 4,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4,
          fontSize: '0.82em',
          padding: '4px 14px',
          minHeight: 0,
        },
        outlined: {
          borderColor: '#ccc',
        },
      },
    },
  },
});

export default theme;
