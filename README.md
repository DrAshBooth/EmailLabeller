# Email Intent Visualizer

A React component for visualizing and editing NLP predictions on email content, with a focus on intents, actions, and artefacts.

## Overview

This application provides an interactive UI that allows users to:
- View email content alongside structured NLP predictions
- Highlight evidence spans in the email that support predictions
- Edit and correct evidence spans and prediction labels
- Submit feedback on incorrect predictions for model improvement

## Project Structure

- `/src/EmailIntentVisualizer.jsx` - Main component for visualization and editing
- `/src/EmailIntentVisualizer.css` - Styling for the visualization component
- `/src/App.jsx` - Demo application that implements the EmailIntentVisualizer
- `/src/mockApiResponse.js` - Mock data provider for development
- `/src/mockFeedbackApi.js` - Mock feedback API service for demonstration
- `/src/example*.json` - Example NLP API response data files

## Features

- HTML email body rendering with XPath-based evidence highlighting
- Bi-directional selection between prediction cards and highlighted evidence
- Color-coded evidence spans mapped to prediction types
- Interactive editing mode for correcting evidence spans
- Feedback submission for model improvement

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

## Component Usage

```jsx
import EmailIntentVisualizer from './EmailIntentVisualizer';

function App() {
  // API response containing email content and NLP predictions
  const apiResponse = { ... };
  
  // Callback for handling feedback submission
  const handleFeedbackSubmit = (feedback) => {
    // Process feedback data
  };

  return (
    <EmailIntentVisualizer 
      apiResponse={apiResponse}
      onFeedbackSubmit={handleFeedbackSubmit}
      readOnly={false}
      theme="light"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| apiResponse | Object | required | NLP API response containing email content and predictions |
| onFeedbackSubmit | Function | required | Callback for handling feedback submission |
| readOnly | Boolean | false | When true, disables editing capabilities |
| theme | String | 'light' | UI theme ('light' or 'dark') |

## API Response Structure

The component expects a specific structure for the API response:

```json
{
  "email": {
    "body": {
      "content": "...", 
      "document_type": "html"
    }
  },
  "intent_parser_result": {
    "predictions": [
      {
        "type": "intent",
        "value": "...",
        "evidence_spans": [...]
      }
    ]
  }
}
```

## License

MIT
