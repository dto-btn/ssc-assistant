import React from 'react';
import Playground from '../playground/Playground';

// Load environment variables from .env file

// Define an interface for props if required in the future
interface PlaygroundProps {
    // Define any props expected here, e.g., title?: string;
}

// Read the feature flag value from the .env file
const isPlaygroundEnabled = import.meta.env.VITE_PLAYGROUND_ON === 'true';

// Read the feature flag value from the .env file
const PlaygroundRoute: React.FC<PlaygroundProps> = (props) => {
    if (!isPlaygroundEnabled) {
        // If the flag is false, the route is disabled (return null to render nothing)
        return null;
    }

    return <Playground {...props} />;
};

export default PlaygroundRoute;