import { Box, Divider, Stack, Typography, Button } from '@mui/material';
import 'highlight.js/styles/github.css'
import { useTranslation } from 'react-i18next';
import ProfileCard from '../components/ProfileCard';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';


interface ProfileCardContainerProps {
    profiles: EmployeeProfile[];
    extraProfiles: EmployeeProfile[];
    isExpanded: boolean;
    toggleShowProfileHandler: () => void;
}

const ProfileCardsContainer = (props: ProfileCardContainerProps) => {
    const { t } = useTranslation();
    const { profiles, extraProfiles, isExpanded, toggleShowProfileHandler } = props;

    return (
        <>
            <Divider />
            <Box sx={{ m: 2, maxWidth: '100%', margin: '10px 16px' }}>
                <Button 
                    sx={{borderRadius: '10px', marginBottom: isExpanded ? '10px' : '0px'}} 
                    onClick={() => toggleShowProfileHandler()} 
                    endIcon={
                        !isExpanded 
                            ? <ExpandMoreIcon style={{ fontSize: 35, paddingBottom: "3px"  }} /> 
                            : <ExpandLessIcon style={{ fontSize: 35, paddingBottom: "3px" }} />
                    } 
                > 
                    {!isExpanded ? t("chat.show.profiles") : t("chat.hide.profiles")} 
                </Button>
                {isExpanded &&
                <Stack direction="column" spacing={2} useFlexGap flexWrap="wrap">
                    {profiles.map((profile, index) => {
                        return (
                            <ProfileCard 
                                profile={profile}
                                key={index}
                            />
                        )
                    })}
                    {extraProfiles.length > 0 &&
                        <>
                            <Typography sx={{padding: '10px 8px 0px 8px', fontSize: 14, color: 'primary.main', fontWeight: 500}}>
                                {t("chat.additional.profiles")}
                            </Typography>
                            {extraProfiles.map((profile, index) => {
                                return (
                                    <ProfileCard
                                        key={index}
                                        profile={profile}
                                    />
                                )
                            })}
                        </>
                    }
                </Stack>
                }
            </Box>
        </>
    )
}

export default ProfileCardsContainer;
