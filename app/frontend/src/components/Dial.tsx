import { useTranslation } from 'react-i18next';
import { SpeedDial, SpeedDialAction, SpeedDialIcon, Box } from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import DeleteIcon from '@mui/icons-material/Delete';

interface DialProps {
  onNewChat: () => void;
  onClearChat: () => void;
  drawerVisible: boolean;
}

export const Dial = ({ onNewChat, onClearChat, drawerVisible }: DialProps) => {
  const { t } = useTranslation();

  const actions = [
    { icon: <AddCommentIcon />, name: t('new.conversation'), handler: onNewChat },
    { icon: <DeleteIcon />, name: t('clear.conversation'), handler: onClearChat },
  ];

  return (
    <Box style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2000 }} sx={{ display: { xs: 'none', sm: 'block' }}}>
      <SpeedDial
        ariaLabel="SpeedDial"
        sx={{ position: 'absolute', bottom: 2, right: 2 }}
        icon={<SpeedDialIcon />}
        hidden={drawerVisible}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.handler}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};