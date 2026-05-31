import { createTheme } from '@mui/material/styles';

const FIELD_BG = '#43423c';
const FIELD_TEXT = '#fff';
const FIELD_LABEL = 'rgba(255,255,255,0.55)';
const FIELD_BORDER = 'rgba(255,255,255,0.15)';
const FIELD_BORDER_HOVER = 'rgba(255,255,255,0.3)';
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
          backgroundColor: FIELD_BG,
          color: FIELD_TEXT,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: FIELD_BORDER,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: FIELD_BORDER_HOVER,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
            borderColor: FIELD_BORDER_HOVER,
          },
          '&.Mui-disabled': {
            backgroundColor: FIELD_BG,
          },
        },
        input: {
          padding: '6px 10px',
          color: FIELD_TEXT,
          '&::placeholder': {
            color: FIELD_LABEL,
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          color: FIELD_LABEL,
          fontWeight: 500,
          fontSize: '0.7em',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          '&.Mui-focused': {
            color: FIELD_LABEL,
          },
          '&.MuiInputLabel-shrink': {
            color: FIELD_LABEL,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '6px 10px',
          color: FIELD_TEXT,
        },
        icon: {
          color: FIELD_LABEL,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#fff',
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
        root: {
          '& .MuiAutocomplete-popupIndicator': {
            color: FIELD_LABEL,
          },
          '& .MuiAutocomplete-clearIndicator': {
            color: FIELD_LABEL,
          },
          '& .MuiAutocomplete-inputRoot': {
            color: FIELD_TEXT,
          },
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
