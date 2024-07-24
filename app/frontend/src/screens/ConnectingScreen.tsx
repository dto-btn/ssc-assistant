import { Box, CircularProgress, Typography, styled } from "@mui/material";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png"

const ConnectingScreen = () => {
    return (
        <ConnectingScreenView>
            <ConnectingContainer>
                <img src={logo} style={{width: 'auto', height: '100px'}} alt="logo of SSC" />
                <ConnectingTextWrapper>
                    <ConnectingText variant="h6" align="left">En cours de connection...</ConnectingText>
                    <ConnectingText variant="h6" align="left">Connecting...</ConnectingText>
                </ConnectingTextWrapper>
            </ConnectingContainer>
            <LoadingSpinnerView sx={{ display: 'flex', justifyContent: 'center', my: '2rem', marginTop: '100px' }}>
                <CircularProgress
                    sx={{ color: 'url(#multicolor)' }}
                    size={50}
                />
            </LoadingSpinnerView>
        </ConnectingScreenView>
    )
}

export default ConnectingScreen;

const ConnectingScreenView = styled(Box)`
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 70vh;
`;

const ConnectingContainer = styled(Box)`
    display: flex;
    justify-content: center;
    width: 25%;
    padding: 50px;
`;

const ConnectingTextWrapper = styled(Box)`
    margin-left: 50px;
`;

const ConnectingText = styled(Typography)`
    padding: 10px 0px;
`;

const LoadingSpinnerView = styled(Box)`
    display: flex;
    justify-content: center;
`;

