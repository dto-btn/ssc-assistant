import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import TopMenu from './components/TopMenu'
import ChatInput from './components/ChatInput'
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { purple, pink } from '@mui/material/colors';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4c3e99",
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: '#f2f2f2',
    }
  },

});

function App() {

  return (
    <>
      <ThemeProvider theme={mainTheme}>
        <CssBaseline />
        <TopMenu/>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Box sx={{ flex: '1 1 auto' }}>
            {/* Other content of your application can go here */}
          </Box>
          <Container maxWidth="sm" component="footer" sx={{ mb: 1, }}>
            <ChatInput />
          </Container>
        </Box>
      </ThemeProvider>
    </>
  )
}

export default App
