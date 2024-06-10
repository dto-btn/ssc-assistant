import { Box, Card, CardContent, Divider, Stack, Typography, CardActions, Button, CardHeader, Avatar } from '@mui/material';
import 'highlight.js/styles/github.css'
import { styled } from '@mui/system';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LaunchIcon from '@mui/icons-material/Launch';
import { useTranslation } from 'react-i18next';


interface ProfileCardProps {
    profiles: EmployeeProfile[];
    isExpanded: boolean;
    toggleShowProfileHandler: () => void;
}

const ProfileCards = (props: ProfileCardProps) => {
    const { t } = useTranslation();
    const { profiles, isExpanded, toggleShowProfileHandler } = props;
    const language = document.documentElement.lang;

    return (
        <>
            <Divider />
            <Box sx={{ m: 2, maxWidth: '100%' }}>
                    <Button onClick={() => toggleShowProfileHandler()} > {!isExpanded ? t("chat.show.profiles") : t("chat.hide.profiles")} </Button>
                {isExpanded &&
                <Stack direction="column" spacing={2} useFlexGap flexWrap="wrap">
                    {profiles.map((profile, index) => {
                        return (
                            <Card  key={index} sx={{ width: 400, borderRadius: 5 }}>
                                <CardHeader
                                    avatar={
                                        <Avatar sx={{ bgcolor: 'primary.main' }} aria-label="recipe">
                                        {profile.name.split(' ').map(part => part[0]).join('').toUpperCase()}
                                        </Avatar>
                                    }
                                    title={profile.name}
                                    titleTypographyProps={{
                                        variant: 'h6',
                                    }}
                                    subheader={language === "en" ? profile.organization_en : profile.organization_fr}
                                />
                                <CardContent>
                                    <EmailView>
                                        <EmailIcon sx={{ marginRight: 2}}/>
                                        <Typography sx={{ fontSize: 15 }} color="text.secondary" gutterBottom>
                                            <a href={`mailto:${profile.email}`}>{profile.email}</a>
                                        </Typography>
                                    </EmailView>

                                    {profile.phone &&
                                    <PhoneView>
                                        <PhoneIcon sx={{ marginRight: 2}}/>
                                        {profile.phone &&
                                        <Typography sx={{ fontSize: 15 }} color="text.secondary" gutterBottom>
                                            {profile.phone}
                                        </Typography>
                                        }
                                    </PhoneView>
                                    }
                                </CardContent>
                                <CardActions sx={{marginLeft: 1}}>
                                    <Button
                                        href={profile.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        endIcon={<LaunchIcon />}
                                        size="large"
                                    >
                                        GEDS
                                    </Button>
                                </CardActions>
                            </Card>
                        )
                    })}
                </Stack>
                }
            </Box>
        </>
    )
}

export default ProfileCards;

const EmailView = styled(Box)`
  display: flex;
  flex-direction: row;
  margin: 0px 0px 15px 8px;
`

const PhoneView = styled(Box)`
  display: flex;
  flex-direction: row;
  margin: 15px 0px 0px 8px;

`