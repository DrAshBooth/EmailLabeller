import React, { useState, useEffect, useRef, useCallback } from 'react';
import './EmailIntentVisualizer.css';

/**
 * EmailIntentVisualizer Component
 * 
 * This component visualizes structured NLP analysis results for emails, including
 * intent, action, and artefact data. It displays the email content and highlights
 * evidence spans that correspond to predictions.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.apiResponse - Structured API response with email data and predictions
 * @param {Function} props.onFeedbackSubmit - Handler for feedback submission
 * @param {boolean} props.readOnly - Whether the component is in read-only mode
 * @param {string} props.theme - UI theme ('light' or 'dark')
 */
const EmailIntentVisualizer = ({ apiResponse, onFeedbackSubmit, readOnly = false, theme = 'light' }) => {
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [activeSpan, setActiveSpan] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [feedbackData, setFeedbackData] = useState({});
  const [isHtmlContent, setIsHtmlContent] = useState(false);
  const [editPanelVisible, setEditPanelVisible] = useState(false);
  
  const emailBodyRef = useRef(null);

  // Reset state when API response changes
  useEffect(() => {
    setSelectedPrediction(null);
    setEditMode(false);
    setActiveSpan(null);
  }, [apiResponse]);

  /**
   * Normalizes an XPath expression for better compatibility with the DOM
   * @param {string} xpath - The original XPath string
   * @returns {Object} - Normalized XPath object with variations
   */
  const normalizeXPath = useCallback((xpath) => {
    if (!xpath) return '';
    
    // Create alternative XPath formats to try
    let xpathVariations = [];
    
    // If the XPath starts with /html/body, adjust it for our wrapper
    if (xpath.startsWith('/html/body')) {
      // Original without /html/body
      xpathVariations.push(xpath.replace('/html/body', ''));
      
      // Special case for table cells
      if (xpath.includes('table')) {
        // Different variations for tables will be tried in getElementByXPath
      }
    }
    
    // Add variations without html prefix
    if (xpath.startsWith('/html')) {
      xpathVariations.push(xpath.replace('/html', ''));
    }
    
    // Simplify path
    let simplePath = xpath;
    if (simplePath.startsWith('/html/body')) {
      simplePath = simplePath.replace('/html/body', ''); 
    }
    if (simplePath === '') simplePath = '.';
    
    // Final normalized path
    return { 
      original: xpath,
      simplified: simplePath,
      variations: xpathVariations
    };
  }, []);

  /**
   * Creates an overlay element for a DOM node
   * @param {Node} node - The DOM node to create overlay for
   * @param {Object} span - The evidence span data
   * @param {string} spanId - Unique ID for this span
   * @returns {HTMLElement|null} - The created overlay element or null if failed
   */
  const createOverlayForNode = useCallback((node, span, spanId) => {
    try {
      if (!node) return null;
      
      // Create the overlay element
      const overlay = document.createElement('span');
      overlay.className = `evidence-overlay overlay-${span.type || 'default'}`;
      
      // Set span data attributes
      overlay.dataset.spanId = spanId;
      overlay.dataset.spanType = span.type || '';
      overlay.dataset.fieldName = span.field || '';
      overlay.dataset.clickable = (!readOnly).toString();
      
      // Position the overlay
      const nodeRect = node.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      
      return overlay;
    } catch (error) {
      console.error('Error creating overlay for node:', error);
      return null;
    }
  }, [readOnly]);

  /**
   * Creates an overlay for a text selection span
   * @param {Object} span - The evidence span data
   * @param {string} spanId - Unique ID for this span
   * @returns {HTMLElement|null} - The created text overlay element or null if failed
   */
  const createTextOverlay = useCallback((span, spanId) => {
    try {
      if (!span || span.start === undefined || span.end === undefined) {
        return null;
      }
      
      // Create the text overlay element
      const overlay = document.createElement('span');
      overlay.className = `text-evidence-overlay overlay-${span.type || 'default'}`;
      
      // Set span data attributes
      overlay.dataset.spanId = spanId;
      overlay.dataset.spanType = span.type || '';
      overlay.dataset.fieldName = span.field || '';
      overlay.dataset.start = span.start;
      overlay.dataset.end = span.end;
      overlay.dataset.clickable = (!readOnly).toString();
      
      // Set content
      overlay.textContent = span.text || '';
      
      return overlay;
    } catch (error) {
      console.error('Error creating text overlay:', error);
      return null;
    }
  }, [readOnly]);

  /**
   * Evaluates an XPath expression and returns matching nodes
   * @param {Object} xpathObj - Normalized XPath object with variations
   * @param {Node} contextNode - The context node to evaluate against
   * @returns {Array} - Array of matching DOM nodes
   */
  const getElementByXPath = useCallback((xpathObj, contextNode) => {
    if (!xpathObj || !contextNode) return [];
    
    const { original, simplified, variations } = xpathObj;
    let result = [];
    
    try {
      // Try the original XPath
      const nodes = document.evaluate(
        original,
        contextNode,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      for (let i = 0; i < nodes.snapshotLength; i++) {
        result.push(nodes.snapshotItem(i));
      }
      
      if (result.length > 0) return result;
      
      // Try the simplified XPath
      const simpleNodes = document.evaluate(
        simplified,
        contextNode,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      for (let i = 0; i < simpleNodes.snapshotLength; i++) {
        result.push(simpleNodes.snapshotItem(i));
      }
      
      if (result.length > 0) return result;
      
      // Try variations
      for (const variation of variations) {
        const varNodes = document.evaluate(
          variation,
          contextNode,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        
        for (let i = 0; i < varNodes.snapshotLength; i++) {
          result.push(varNodes.snapshotItem(i));
        }
        
        if (result.length > 0) break;
      }
    } catch (error) {
      console.error('XPath evaluation error:', error);
    }
    
    return result;
  }, []);

  /**
   * Helper function to find the first text node in an element
   * @param {Node} node - The node to search for text nodes
   * @returns {Node|null} - The first text node found or null
   */
  const findFirstTextNode = useCallback((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') return node;
    
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '') {
          return child;
        }
        
        const found = findFirstTextNode(child);
        if (found) return found;
      }
    }
    return null;
  }, []);

  /**
   * Creates an evidence span with highlighting
   * @param {Object} span - The evidence span data
   * @param {boolean} isActive - Whether this is the active span
   * @returns {HTMLElement|null} - The created span element or null if failed
   */
  const createEvidenceSpan = useCallback((span, isActive = false) => {
    try {
      const { type, field: fieldName, text } = span;
      
      const spanElement = document.createElement('span');
      spanElement.className = `evidence-span evidence-${type || 'default'}`;
      if (isActive) spanElement.classList.add('active');
      
      // Add data attributes
      spanElement.dataset.type = type || '';
      spanElement.dataset.field = fieldName || '';
      
      // Add tooltip text based on type
      let tooltipText = 'Evidence';
      if (type === 'intent') tooltipText = 'Intent';
      else if (type === 'action') tooltipText = 'Action';
      else if (type === 'artefact_type') tooltipText = 'Artefact Type';
      else if (type === 'artefact_detail') tooltipText = `Artefact Detail: ${fieldName || ''}`;
      spanElement.title = tooltipText;
      
      // In edit mode, add resize handles
      if (editMode && isActive) {
        const startHandle = document.createElement('span');
        startHandle.className = 'resize-handle start';
        startHandle.title = 'Drag to adjust start position';
        startHandle.dataset.handleType = 'start';
        
        const endHandle = document.createElement('span');
        endHandle.className = 'resize-handle end';
        endHandle.title = 'Drag to adjust end position';
        endHandle.dataset.handleType = 'end';
        
        const content = document.createTextNode(text || '');
        
        spanElement.appendChild(startHandle);
        spanElement.appendChild(content);
        spanElement.appendChild(endHandle);
      } else {
        spanElement.textContent = text || '';
      }
      spanElement.dataset.spanText = text || '';
      
      return spanElement;
    } catch (error) {
      console.error('Error creating evidence span:', error);
      return null;
    }
  }, [editMode]);

  /**
   * Applies highlights to the email body for evidence spans
   * @param {HTMLElement} emailBodyElement - The email body element
   * @param {Array} evidenceSpans - Array of evidence spans to highlight
   */
  const applyHighlights = useCallback((emailBodyElement, evidenceSpans) => {
    if (!emailBodyElement || !evidenceSpans || !Array.isArray(evidenceSpans)) return;
    
    try {
      // Process each evidence span
      evidenceSpans.forEach((span, index) => {
        const spanId = `span-${index}-${Date.now()}`;
        
        if (span.xpath && span.relative_start !== undefined && span.relative_end !== undefined) {
          // Normalize the XPath for better compatibility
          const normalizedXPath = normalizeXPath(span.xpath);
          
          // Find matching nodes for this XPath
          const nodes = getElementByXPath(normalizedXPath, emailBodyElement);
          
          if (nodes && nodes.length > 0) {
            // Process each matched node
            nodes.forEach(node => {
              if (node) {
                try {
                  // Create an overlay element
                  const overlay = createOverlayForNode(node, span, spanId);
                  if (overlay) {
                    // Add type-specific class for color coding
                    if (span.type) {
                      overlay.classList.add(`overlay-${span.type}`);
                    }
                    
                    // Find text node and get correct positions
                    const textNode = findFirstTextNode(node);
                    
                    if (textNode) {
                      // Create a wrapper for the text node and the overlay
                      const wrapper = document.createElement('span');
                      wrapper.className = 'evidence-overlay-container';
                      
                      // Replace text node with wrapper
                      textNode.parentNode.replaceChild(wrapper, textNode);
                      
                      // Add text node back inside the wrapper
                      wrapper.appendChild(textNode);
                      
                      // Add overlay to the wrapper
                      wrapper.appendChild(overlay);
                      
                      // Set position for text-based evidence
                      if (span.relative_start !== undefined && span.relative_end !== undefined) {
                        overlay.dataset.relativeStart = span.relative_start;
                        overlay.dataset.relativeEnd = span.relative_end;
                      }
                    }
                  }
                } catch (error) {
                  console.error('Error applying highlight to node:', error);
                }
              }
            });
          } else if (span.text) {
            // Text-based fallback if XPath doesn't match
            const textOverlay = createTextOverlay(span, spanId);
            // Implementation for text-based highlighting
          }
        }
      });
      
      // Note: Event delegation is now handled by a separate useEffect
      
    } catch (error) {
      console.error('Error applying highlights:', error);
    }
  }, [normalizeXPath, createOverlayForNode, createTextOverlay, findFirstTextNode, getElementByXPath]);

  // Function to clear all evidence highlights from the email body
  const clearHighlights = useCallback(() => {
    if (!emailBodyRef.current) return;
    
    // Remove all overlay containers (which contain our evidence highlights)
    const overlayContainers = emailBodyRef.current.querySelectorAll('.evidence-overlay-container');
    
    overlayContainers.forEach(container => {
      // Get the original text content
      const originalText = container.textContent;
      
      // Create a new text node with the original content
      const textNode = document.createTextNode(originalText);
      
      // Replace the container with the original text
      container.parentNode.replaceChild(textNode, container);
    });
  }, []);

  // Apply highlights when selectedPrediction changes
  useEffect(() => {
    // Only apply highlights if we have a valid email body and selected prediction
    if (!emailBodyRef.current || !isHtmlContent || !selectedPrediction?.evidence_spans?.length) return;
    
    // First clear any existing highlights
    clearHighlights();
    
    // Apply highlights for each span in the selected prediction
    if (selectedPrediction && selectedPrediction.evidence_spans) {
      applyHighlights(emailBodyRef.current, selectedPrediction.evidence_spans);
    }
  }, [selectedPrediction, isHtmlContent, applyHighlights, clearHighlights]);

  // Handle selection mode changes
  useEffect(() => {
    if (!emailBodyRef.current) return;
    
    if (selectionMode) {
      emailBodyRef.current.classList.add('selection-mode');
    } else {
      emailBodyRef.current.classList.remove('selection-mode');
    }
  }, [selectionMode]);

  // Handle click on evidence overlays
  const handleOverlayClick = useCallback((event) => {
    // Check if the clicked element is an overlay
    const overlay = event.target.closest('.evidence-overlay');
    if (!overlay) return;
    
    // Prevent event bubbling
    event.stopPropagation();
    
    // If we're in edit mode, handle the overlay click for editing
    if (editMode && !readOnly) {
      const spanType = overlay.dataset.spanType;
      const fieldName = overlay.dataset.fieldName || '';
      
      // Set the active span for editing
      setActiveSpan({
        id: overlay.dataset.spanId,
        type: spanType,
        field: fieldName,
        element: overlay
      });
      
      // Show edit panel
      setEditPanelVisible(true);
    }
  }, [editMode, readOnly]);
  
  // Add/remove event listener for overlays when component mounts/unmounts
  useEffect(() => {
    const emailBody = emailBodyRef.current;
    if (emailBody) {
      emailBody.addEventListener('click', handleOverlayClick);
      return () => {
        emailBody.removeEventListener('click', handleOverlayClick);
      };
    }
  }, [handleOverlayClick]);

  // Handle prediction card click
  const handlePredictionClick = useCallback((prediction) => {
    setSelectedPrediction(prediction);
    setEditMode(false);
    setActiveSpan(null);
  }, []);

  // Handle prediction field click (for editing specific fields)
  const handlePredictionFieldClick = useCallback((fieldType, fieldName = '') => {
    if (readOnly) return;
    
    // Enter edit mode for this specific field
    setEditMode(true);
    setEditingField({ type: fieldType, name: fieldName });
    
    // Filter to find matching spans for this field
    const matchingSpans = selectedPrediction?.evidence_spans?.filter(span => {
      if (fieldType === 'artefact_detail') {
        return span.type === fieldType && span.field === fieldName;
      }
      return span.type === fieldType;
    }) || [];
    
    // Set first matching span as active
    if (matchingSpans.length > 0) {
      setActiveSpan(matchingSpans[0]);
    }
  }, [selectedPrediction, readOnly]);

  // Handle entering selection mode
  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  // Handle exiting selection mode
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
  }, []);

  // Handle submit feedback action
  const handleSubmitFeedback = useCallback(() => {
    if (onFeedbackSubmit && Object.keys(feedbackData).length > 0) {
      onFeedbackSubmit(feedbackData);
      setFeedbackData({});
    }
  }, [feedbackData, onFeedbackSubmit]);

  // Check if content is HTML when apiResponse changes
  useEffect(() => {
    if (apiResponse?.email?.body) {
      const { document_type, content } = apiResponse.email.body;
      const isHtml = document_type === 'html' || (content && content.startsWith('<'));
      setIsHtmlContent(isHtml);
    }
  }, [apiResponse]);

  // Render the email content based on the API response
  const renderEmailContent = useCallback(() => {
    if (!apiResponse || !apiResponse.email || !apiResponse.email.body) {
      return <div className="email-body">No content available</div>;
    }

    const { content } = apiResponse.email.body;
    
    // Render HTML content or plain text
    if (isHtmlContent) {
      return (
        <div 
          className={`email-body${editMode ? ' edit-mode' : ''}`}
          ref={emailBodyRef}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    } else {
      // Plain text rendering
      return (
        <div className={`email-body${editMode ? ' edit-mode' : ''}`} ref={emailBodyRef}>
          {content}
        </div>
      );
    }
  }, [apiResponse, editMode, isHtmlContent]);

  // Render the prediction cards based on API data
  const renderPredictionCards = useCallback(() => {
    if (!apiResponse?.intent_parser_result?.predictions) {
      return <p>No predictions available</p>;
    }

    return apiResponse.intent_parser_result.predictions.map((prediction, index) => {
      const isSelected = selectedPrediction && selectedPrediction.prediction_id === prediction.prediction_id;
      const isEditingIntent = editingField?.type === 'intent';
      const isEditingAction = editingField?.type === 'action';
      const isEditingArtefactType = editingField?.type === 'artefact_type';
      
      return (
        <div 
          key={prediction.prediction_id || index}
          className={`prediction-card ${isSelected ? 'selected' : ''}`}
          onClick={() => handlePredictionClick(prediction)}
        >
          <div className="prediction-header">
            <span className="prediction-type">{prediction.intent}</span>
          </div>
          
          <div className="prediction-content">
            <p 
              data-field="intent" 
              className={`highlight-intent clickable ${isEditingIntent ? 'editing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePredictionFieldClick('intent');
              }}
            >
              <strong>Intent:</strong> {prediction.intent}
            </p>
            
            <p 
              data-field="action" 
              className={`highlight-action clickable ${isEditingAction ? 'editing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePredictionFieldClick('action');
              }}
            >
              <strong>Action:</strong> {prediction.action}
            </p>
            
            <p 
              data-field="artefact" 
              className={`highlight-artefact_type clickable ${isEditingArtefactType ? 'editing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePredictionFieldClick('artefact_type');
              }}
            >
              <strong>Artefact:</strong> {prediction.artefact?.type}
            </p>
            
            {/* Render artefact details if available */}
            {prediction.artefact?.details && (
              <div className="artefact-details">
                <p><strong>Details:</strong></p>
                <ul className="artefact-details-list">
                  {Object.entries(prediction.artefact.details).map(([key, value]) => {
                    const isEditingThisField = editingField?.type === 'artefact_detail' && editingField?.name === key;
                    
                    return (
                      <li 
                        key={key} 
                        data-field={key} 
                        className={`highlight-artefact_detail clickable ${isEditingThisField ? 'editing' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePredictionFieldClick('artefact_detail', key);
                        }}
                      >
                        <strong>{key}:</strong> {value}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [apiResponse, selectedPrediction, editingField, handlePredictionClick, handlePredictionFieldClick]);

  return (
    <div className={`email-intent-visualizer ${theme} ${selectionMode ? 'selection-mode' : ''}`}>
      <div className="visualizer-container">
        <div className="email-section">
          <div className="email-header">
            <h3>{apiResponse?.email?.header?.subject || 'No Subject'}</h3>
            <div className="email-metadata">
              <p><strong>From:</strong> {apiResponse?.email?.header?.from?.name} &lt;{apiResponse?.email?.header?.from?.email}&gt;</p>
              <p><strong>To:</strong> {apiResponse?.email?.header?.to?.[0]?.name} &lt;{apiResponse?.email?.header?.to?.[0]?.email}&gt;</p>
              <p><strong>Date:</strong> {new Date(apiResponse?.email?.header?.received).toLocaleString()}</p>
            </div>
          </div>
          
          {renderEmailContent()}
        </div>
        
        <div className="predictions-section">
          <h3>Detected Intents and Actions</h3>
          
          <div className="prediction-cards">
            {renderPredictionCards()}
          </div>
          
          {selectedPrediction && !readOnly && (
            <div className="prediction-actions">
              <button 
                onClick={() => setEditMode(!editMode)} 
                disabled={editMode}
                className={`action-btn ${editMode ? 'disabled' : ''}`}
              >
                Edit Evidence
              </button>
              <button 
                onClick={handleSubmitFeedback} 
                disabled={Object.keys(feedbackData).length === 0}
                className="submit-btn"
              >
                Submit Feedback
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit panel for evidence editing */}
      {editPanelVisible && activeSpan && editMode && (
        <div className="edit-panel">
          <h4>Edit Evidence</h4>
          <div className="edit-controls">
            <button onClick={enterSelectionMode} className="selection-btn">
              Select New Text
            </button>
            <button onClick={exitSelectionMode} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Selection mode guide */}
      {selectionMode && (
        <div className="selection-guide">
          Select text for evidence, then click "Apply"
        </div>
      )}
    </div>
  );
};

export default EmailIntentVisualizer;
