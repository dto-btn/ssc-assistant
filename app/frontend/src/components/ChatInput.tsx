import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

export default function ChatInput() {
  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      sx={{
        
      }}
    >
      <TextField id="outlined-basic" 
                label="Ask your question" 
                variant="outlined" 
                fullWidth={true}
                multiline={true}
                minRows={2}
                maxRows={6}
                sx={{
                    bgcolor: 'white',
                }}/>
    </Box>
  );
}