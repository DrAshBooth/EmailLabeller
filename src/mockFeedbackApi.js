// mockFeedbackApi.js - Mock API service for handling feedback submissions

// Simulate an API call with a delay
const mockApiCall = (data, successRate = 0.9) => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      // Simulate success/failure rate
      if (Math.random() < successRate) {
        resolve({
          success: true,
          message: 'Feedback submitted successfully',
          feedback_id: `feedback-${Date.now()}`,
          timestamp: new Date().toISOString(),
          data
        });
      } else {
        reject({
          success: false,
          message: 'Error submitting feedback',
          error_code: 'API_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }, 800); // Simulate a network delay of 800ms
  });
};

// Mock feedback API service
export const FeedbackApiService = {
  // Submit feedback for corrected prediction
  submitFeedback: async (feedbackData) => {
    console.log('Submitting feedback:', feedbackData);
    
    try {
      const response = await mockApiCall(feedbackData);
      console.log('Feedback API response:', response);
      return response;
    } catch (error) {
      console.error('Error in feedback submission:', error);
      throw error;
    }
  },
  
  // Get feedback history (mock implementation)
  getFeedbackHistory: async (requestId) => {
    console.log('Fetching feedback history for request:', requestId);
    
    try {
      const response = await mockApiCall({
        request_id: requestId,
        feedback_items: [
          {
            feedback_id: `feedback-${Date.now() - 86400000}`, // yesterday
            prediction_id: '4d7f2a23-e3bd-44cb-8d35-b1c1dc4fae91',
            feedback_type: 'incorrect_action',
            corrected_value: {
              action: 'provide_documentation'
            },
            submitted_by: 'user@example.com',
            timestamp: new Date(Date.now() - 86400000).toISOString()
          }
        ]
      });
      
      return response;
    } catch (error) {
      console.error('Error fetching feedback history:', error);
      throw error;
    }
  }
};

// Helper function to validate feedback data
export const validateFeedbackData = (feedbackData) => {
  // Required fields for all feedback types
  if (!feedbackData.prediction_id) return { valid: false, error: 'Missing prediction_id' };
  if (!feedbackData.request_id) return { valid: false, error: 'Missing request_id' };
  if (!feedbackData.feedback_type) return { valid: false, error: 'Missing feedback_type' };
  
  // Type-specific validations
  switch (feedbackData.feedback_type) {
    case 'incorrect_intent':
    case 'incorrect_action':
      if (!feedbackData.corrected_value) return { valid: false, error: 'Missing corrected_value' };
      break;
      
    case 'evidence_span_correction':
      if (!feedbackData.corrected_value?.evidence_spans?.length) {
        return { valid: false, error: 'Missing evidence span corrections' };
      }
      break;
      
    default:
      return { valid: false, error: 'Invalid feedback_type' };
  }
  
  return { valid: true };
};
