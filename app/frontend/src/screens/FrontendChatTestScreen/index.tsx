import { Container, Paper } from '@mui/material';
import { ChatDemo } from './ChatDemo';

export const FrontendChatTestScreen = () => {
    return (
        <Container maxWidth="lg" sx={{ height: '100vh', py: 4 }}>
            <Paper
                elevation={3}
                sx={{
                    height: 'calc(100% - 2rem)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <ChatDemo />
            </Paper>
        </Container>
    );
}