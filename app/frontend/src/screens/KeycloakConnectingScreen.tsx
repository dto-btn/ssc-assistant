import { Box, CircularProgress, Typography, styled } from "@mui/material";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";

const KeycloakConnectingScreen = () => {
  return (
    <ConnectingScreenView>
      <ConnectingContainer>
        <Logo src={logo} alt="logo of SSC" />
        <ConnectingTextWrapper>
          <ConnectingText variant="h6" align="left">En cours de connection...</ConnectingText>
          <ConnectingText variant="h6" align="left">Connecting...</ConnectingText>
        </ConnectingTextWrapper>
      </ConnectingContainer>
      <LoadingSpinnerView>
        <CircularProgressStyled size={50} />
      </LoadingSpinnerView>
    </ConnectingScreenView>
  );
};

export default KeycloakConnectingScreen;

const Logo = styled("img")({
  width: "auto",
  height: "100px",
});

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
  margin-bottom: 2rem;
  margin-top: 100px;
`;

const CircularProgressStyled = styled(CircularProgress)`
  color: url(#multicolor);
`;
