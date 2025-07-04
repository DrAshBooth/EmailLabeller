import React, { useState, useEffect } from 'react';
import EmailIntentVisualizer from './EmailIntentVisualizer';
import { FeedbackApiService } from './mockFeedbackApi';
import './App.css';

// Import example JSON files
import example1 from './example1.json';
import example2 from './example2.json';
import example3 from './example3.json';

function App() {
  const [apiResponse, setApiResponse] = useState(example1);
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [theme, setTheme] = useState('light');
  const [readOnly, setReadOnly] = useState(false);
  
  // Examples collection
  const examples = [example1, example2, example3];

  // Cycle through example responses
  const cycleExample = () => {
    const nextIndex = (currentExampleIndex + 1) % examples.length;
    setCurrentExampleIndex(nextIndex);
    setApiResponse(examples[nextIndex]);
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedbackData) => {
    setLoading(true);
    
    try {
      const response = await FeedbackApiService.submitFeedback(feedbackData);
      setNotification({
        type: 'success',
        message: 'Feedback submitted successfully!'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Error submitting feedback. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle theme between light and dark
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Toggle read-only mode
  const toggleReadOnly = () => {
    setReadOnly(prev => !prev);
  };

  return (
    <div className={`app ${theme}`}>
      <header className="app-header">
        <h1>Email Intent Visualizer</h1>
        <div className="app-controls">
          <button onClick={cycleExample} className="control-button">
            Next Example ({currentExampleIndex + 1}/{examples.length})
          </button>
          <button onClick={toggleTheme} className="control-button">
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
          <button onClick={toggleReadOnly} className="control-button">
            {readOnly ? '✏️ Enable Editing' : '👁️ Read Only'}
          </button>
        </div>
      </header>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <main className="app-main">
        <EmailIntentVisualizer 
          apiResponse={apiResponse} 
          onFeedbackSubmit={handleFeedbackSubmit}
          readOnly={readOnly}
          theme={theme}
        />
      </main>
      
      <footer className="app-footer">
        <p>
          This is a demonstration of the Email Intent Visualizer component.
          {loading && <span className="loading-indicator"> Processing...</span>}
        </p>
      </footer>
      
      <div className="app-instructions">
        <h2>How to Use</h2>
        <ol>
          <li>Click on a prediction card on the right to select it</li>
          <li>The evidence spans related to the prediction will be highlighted in the email</li>
          <li>Click on a highlighted span to select it</li>
          <li>Click "Edit Span" to modify the span</li>
          <li>Select text in the email to adjust the span location</li>
          <li>Modify the span type and field as needed</li>
          <li>Click "Apply" to confirm your changes</li>
          <li>Click "Submit Feedback" when you're done making corrections</li>
        </ol>
        <p><strong>Note:</strong> In a real implementation, the feedback would be sent to an actual API endpoint.</p>
      </div>
    </div>
  );
}

export default App;
