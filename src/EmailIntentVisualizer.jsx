import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import './EmailIntentVisualizer.css';

/**
 * EmailIntentVisualizer - A React component for visualizing and editing NLP predictions on emails
 * 
 * This component displays an email alongside structured NLP predictions (intents, actions, artefacts)
 * and allows users to see evidence spans in the email that support these predictions.
 * Users can edit evidence spans and submit feedback on incorrect predictions.
 * 
 * @component
 */

const EmailIntentVisualizer = ({ 
  apiResponse, 
  onFeedbackSubmit, 
  readOnly = false,
  theme = 'light' 
}) => {
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [activeSpan, setActiveSpan] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [feedbackData, setFeedbackData] = useState({});
  const [highlightedText, setHighlightedText] = useState(null);
  const [editPanelVisible, setEditPanelVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false); // For new text selection
  const emailBodyRef = useRef(null);
  const emailContent = apiResponse?.email?.body?.content || '';
  const isHtmlContent = apiResponse?.email?.body?.document_type === 'html';
  const predictions = apiResponse?.intent_parser_result?.predictions || [];

  // Reset feedback data when apiResponse changes
  useEffect(() => {
    setFeedbackData({});
    setSelectedPrediction(null);
    setActiveSpan(null);
    setEditMode(false);
  }, [apiResponse]);

  /**
   * Handles selection of a prediction card
   * @param {Object} prediction - The prediction object to select
   */
  const handlePredictionSelect = (prediction) => {
    setSelectedPrediction(prediction);
    setActiveSpan(null);
    setEditMode(false);
    
    // Clear any existing highlights in prediction cards
    document.querySelectorAll('.highlight-match').forEach(el => {
      el.classList.remove('highlight-match');
    });
  };

  /**
   * Handles when a user clicks on an evidence span in the email
   * @param {Object} span - The evidence span object that was clicked
   */
  const handleSpanClick = (span) => {
    if (readOnly) return;
    setActiveSpan(span);
    setEditMode(true);
  };

  /**
   * Creates a safe HTML object using DOMPurify for dangerously setting inner HTML
   * @param {string} html - Raw HTML string to sanitize
   * @return {Object} Object with __html property containing sanitized HTML
   */
  const createSafeHtml = useCallback((html) => {
    return { __html: DOMPurify.sanitize(html) };
  }, []);

  /**
   * Highlights the corresponding element in the prediction card based on evidence span type
   * @param {string} spanType - The type of span (intent, action, artefact)
   * @param {string} fieldName - The specific field name within the type
   */
  const highlightPredictionCardElement = useCallback((spanType, fieldName) => {
    // Remove any existing highlight classes
    const predictionCard = document.querySelector('.prediction-card.selected');
    if (!predictionCard) return;
    
    // Remove existing highlights
    predictionCard.querySelectorAll('.highlight-match').forEach(el => {
      el.classList.remove('highlight-match');
    });
    
    // Add appropriate highlight based on span type
    if (spanType === 'intent') {
      predictionCard.querySelector('.card-header h4')?.classList.add('highlight-match');
    } else if (spanType === 'action') {
      predictionCard.querySelector('[data-field="action"]')?.classList.add('highlight-match');
    } else if (spanType === 'artefact_type') {
      predictionCard.querySelector('[data-field="artefact"]')?.classList.add('highlight-match');
    } else if (spanType === 'artefact_detail' && fieldName) {
      predictionCard.querySelector(`[data-field="${fieldName}"]`)?.classList.add('highlight-match');
    }
  }, []);

  // Helper function to create an evidence span element
  const createSpanElement = useCallback((text, isActive, spanId, spanType, fieldName) => {
    const span = document.createElement('span');
    
    // Set classes and data attributes for styling and event handling
    span.className = `evidence-span evidence-${spanType} ${isActive ? 'active' : ''}`;
    span.dataset.spanId = spanId;
    span.dataset.spanType = spanType;
    span.dataset.fieldName = fieldName || '';
    span.dataset.clickable = !editMode ? 'true' : 'false';
    
    // Add tooltip information for better UX
    let tooltipText = '';
    if (spanType === 'intent') tooltipText = 'Intent Evidence';
    else if (spanType === 'action') tooltipText = 'Action Evidence';
    else if (spanType === 'artefact_type') tooltipText = 'Artefact Type Evidence';
    else if (spanType === 'artefact_detail') tooltipText = `Artefact Detail: ${fieldName || ''}`;
    span.title = tooltipText;
    
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
      
      const content = document.createTextNode(text);
      
      span.appendChild(startHandle);
      span.appendChild(content);
      span.appendChild(endHandle);
    } else {
      span.textContent = text;
    }
    span.dataset.spanText = text;
    
    return span;
  }, []);

  /**
   * Applies highlight styling to evidence spans in the email body
   * Uses XPath selectors and relative offsets to locate text nodes
   * @param {HTMLElement} element - The container element for the email body
   * @param {Array} spans - The list of evidence spans to apply highlights for
   */
  const applyHighlights = useCallback((element, spans = []) => {
    if (!element || !spans.length) return;
    
    // Process each evidence span
    spans.forEach((span, index) => {
      try {
        
        // Find the DOM element based on XPath
        let xpathResult;
        try {
          // Try to normalize the XPath to fit the DOM structure
          // For email content, we might need to adjust the XPath
          let normalizedXPath = span.xpath;
          
          // Create alternative XPath formats to try
          let xpathVariations = [];
          
          // If the XPath starts with /html/body, adjust it for our wrapper
          if (normalizedXPath.startsWith('/html/body')) {
            // Original without /html/body
            xpathVariations.push(normalizedXPath.replace('/html/body', ''));
            
            // Special case for table cells
            if (normalizedXPath.includes('table')) {
              // Try different variations of table cell paths
              xpathVariations.push(`//table//tr//td[contains(text(), '${span.text}')]`);
              
              // If this is a specific table cell (like tr[2]/td[2])
              if (/tr\[(\d+)\]\/td\[(\d+)\]/.test(normalizedXPath)) {
                const trMatch = normalizedXPath.match(/tr\[(\d+)\]/); 
                const tdMatch = normalizedXPath.match(/td\[(\d+)\]/); 
                if (trMatch && tdMatch) {
                  const trIndex = parseInt(trMatch[1]);
                  const tdIndex = parseInt(tdMatch[1]);
                  xpathVariations.push(`//table/tr[${trIndex}]/td[${tdIndex}]`);
                }
              }
            }
          }
          
          // Add variations without html prefix
          if (normalizedXPath.startsWith('/html')) {
            xpathVariations.push(normalizedXPath.replace('/html', ''));
          }
          
          // Add the original normalized path
          let simplePath = normalizedXPath;
          if (simplePath.startsWith('/html/body')) {
            simplePath = simplePath.replace('/html/body', '');
          }
          if (simplePath === '') simplePath = '.';
          if (simplePath.startsWith('/')) simplePath = simplePath.substring(1);
          xpathVariations.push(simplePath);
          
          // Finally add the original XPath as a fallback
          xpathVariations.push(span.xpath);
          
          // Remove duplicates
          xpathVariations = [...new Set(xpathVariations)];
          
          // Create a namespace resolver function to handle any potential namespaces
          const nsResolver = function(prefix) {
            return null; // We're not using namespaces in this context
          };
          
          // Try all XPath variations until one works
          let targetNode = null;
          
          for (const xpathToTry of xpathVariations) {
            try {
              // Try first in our wrapper element
              xpathResult = document.evaluate(
                xpathToTry,
                element,
                nsResolver,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              
              if (xpathResult.singleNodeValue) {
                targetNode = xpathResult.singleNodeValue;
                break;
              }
              
              // If not found, try in the entire document
              xpathResult = document.evaluate(
                xpathToTry,
                document,
                nsResolver,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              
              if (xpathResult.singleNodeValue) {
                targetNode = xpathResult.singleNodeValue;
                break;
              }
            } catch (e) {
              // Silent catch - continue trying other XPath variations
            }
          }
          
          // Set the result
          if (targetNode) {
            xpathResult = { singleNodeValue: targetNode };
          } else {
            xpathResult = { singleNodeValue: null };
          }
        } catch (xpathError) {
          console.error('XPath evaluation failed:', xpathError);
          return;
        }
        
        const targetElement = xpathResult.singleNodeValue;
        
        if (!targetElement) {
          return;
        }
        
        // Find the appropriate text node - might be directly in the element or in a child
        let textNode = null;
        
        // Helper function to find the first text node
        const findFirstTextNode = (node) => {
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
        };
        
        textNode = findFirstTextNode(targetElement);
        
        if (!textNode) {
          return;
        }
        
        const textContent = textNode.textContent;
        const parentElement = textNode.parentElement;
        
        // Debug log removed: 'Text node found:', textContent);
        
        // Ensure we have valid relative positions
        let relStart = Math.max(0, span.relative_start || 0);
        // If relative_end is not provided, try to use the span's text length
        let relEnd = typeof span.relative_end === 'number' ? span.relative_end : (span.text ? relStart + span.text.length : textContent.length);
        
        // Ensure positions are within bounds
        relStart = Math.min(relStart, textContent.length);
        relEnd = Math.min(relEnd, textContent.length);
        
        // If we have the span's text, try to find it in the content
        if (span.text) {
          // Try direct text search first
          if (textContent.includes(span.text)) {
            const exactPosition = textContent.indexOf(span.text);
            relStart = exactPosition;
            relEnd = exactPosition + span.text.length;
          } 
          // If direct match fails, try trimming whitespace and searching again
          else {
            const trimmedText = span.text.trim();
            if (textContent.includes(trimmedText)) {
              const exactPosition = textContent.indexOf(trimmedText);
              relStart = exactPosition;
              relEnd = exactPosition + trimmedText.length;
            }
            // Try looking for part of the text if it's longer
            else if (trimmedText.length > 5) {
              // Try to find a substring of at least 5 chars
              const partialText = trimmedText.substring(0, Math.min(trimmedText.length, 15));
              if (textContent.includes(partialText)) {
                const exactPosition = textContent.indexOf(partialText);
                relStart = exactPosition;
                relEnd = exactPosition + partialText.length;
              }
            }
          }
        }
        
        // Debug log removed: 'Adjusted relative positions:', relStart, relEnd, 'Text length:', textContent.length);
        
        // Skip if we have invalid positions
        if (relStart >= relEnd || relEnd <= 0 || relEnd > textContent.length) {
          // Skip silently - invalid positions are common with HTML parsing
          // and shouldn't disrupt the user experience
          return;
        }
        
        // Check if this span has been modified in feedback
        let modifiedSpan = null;
        if (selectedPrediction && feedbackData[selectedPrediction.prediction_id]) {
          const correctedSpans = feedbackData[selectedPrediction.prediction_id].corrected_value.evidence_spans || [];
          modifiedSpan = correctedSpans.find(
            s => s.original_xpath === span.xpath && 
                 s.original_relative_start === span.relative_start && 
                 s.original_relative_end === span.relative_end
          );
        }
        
        // Split the text node and insert our highlighted span
        const spanType = span.type || 'default';
        const isActive = activeSpan && 
                         activeSpan.xpath === span.xpath && 
                         activeSpan.relative_start === span.relative_start && 
                         activeSpan.relative_end === span.relative_end;
                         
        // Create the highlighted span elements
        const before = document.createTextNode(textContent.substring(0, relStart));
        const highlight = createSpanElement(
          textContent.substring(relStart, relEnd),
          isActive,
          span.id || `span-${index}`,
          spanType,
          span.field // Pass the field name for artefact details
        );
        const after = document.createTextNode(textContent.substring(relEnd));
        
        // Replace the text node with our before + highlight + after nodes
        parentElement.replaceChild(before, textNode);
        parentElement.insertBefore(highlight, before.nextSibling);
        parentElement.insertBefore(after, highlight.nextSibling);
      } catch (error) {
        console.error('Error applying highlight:', error);
      }
    });
  }, [selectedPrediction, feedbackData, activeSpan, createSpanElement]);

  // Handler for applying text selection to the evidence span
  const handleApplyTextSelection = useCallback(() => {
    // Only apply if we have both selected text and an active highlighted text
    if (!selectedText || !highlightedText) {
      setSelectionMode(false);
      setSelectedText(null);
      return;
    }
    
    // Create updated evidence span based on the new selection
    const updatedSpan = { ...highlightedText };
    
    // Update span properties based on selected text
    updatedSpan.xpath = selectedText.xpath;
    updatedSpan.text = selectedText.text;
    updatedSpan.relative_start = selectedText.startOffset;
    updatedSpan.relative_end = selectedText.endOffset;
    
    // Update highlighted text with new selection
    setHighlightedText(updatedSpan);
    
    // Reset selection mode
    setSelectionMode(false);
    setSelectedText(null);
    setEditPanelVisible(true);
  }, [selectedText, highlightedText]);

  // Function to get XPath for a node (used for text selection)
  
  // Handle text selection for evidence spans
  const handleTextSelection = () => {
    if (readOnly || !editMode) return;
    
    // Enable text selection mode
    setSelectionMode(true);
  };
  
  // Add mouseup event handler for text selection
  useEffect(() => {
    if (!selectionMode || !emailBodyRef.current) return;
    
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      // Get the selected range
      const range = selection.getRangeAt(0);
      if (range.collapsed) return; // No text selected
      
      // Get the selected text
      const text = range.toString().trim();
      if (!text) return;
      
      // Get the container node
      const container = range.commonAncestorContainer;
      const xpath = getXPathForNode(container);
      
      // Calculate offsets
      let startOffset = range.startOffset;
      let endOffset = range.endOffset;
      
      // If the selection is in different nodes, we need to normalize
      if (range.startContainer !== range.endContainer) {
        // This is a simplified approach - for complex selections across multiple nodes,
        // we would need more sophisticated handling
        startOffset = 0;
        endOffset = text.length;
      }
      
      // Store the selected text info
      setSelectedText({
        text,
        xpath,
        startOffset,
        endOffset
      });
      
      // Auto-apply the selection
      setTimeout(() => {
        handleApplyTextSelection();
      }, 100);
    };
    
    emailBodyRef.current.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      if (emailBodyRef.current) {
        emailBodyRef.current.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [selectionMode, handleApplyTextSelection]);

  // Text selection is handled via mouseup event
  
  // Helper function to get XPath for a DOM node
  const getXPathForNode = (node) => {
    // Handle text nodes by getting their parent element
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    
    if (node.tagName === 'HTML') return '/html';
    if (node.tagName === 'BODY') return '/html/body';
    
    let xpath = '';
    let current = node;
    
    while (current !== document.body && current.parentNode) {
      const nodeName = current.nodeName.toLowerCase();
      let index = 1;
      
      // Calculate position among siblings of the same type
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && 
            sibling.nodeName.toLowerCase() === nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      xpath = `/${nodeName}[${index}]${xpath}`;
      current = current.parentNode;
    }
    
    // Add the body path
    return `/html/body${xpath}`;
  };

  // Handle metadata changes for the span (type, field)
  const handleSpanMetadataChange = (key, value) => {
    if (!highlightedText) return;
    setHighlightedText({
      ...highlightedText,
      [key]: value
    });
  };

  // Apply the span edit by updating feedbackData
  const applySpanEdit = () => {
    if (!selectedPrediction || !highlightedText) return;

    // Initialize feedback if not already present
    if (!feedbackData[selectedPrediction.prediction_id]) {
      feedbackData[selectedPrediction.prediction_id] = {
        prediction_id: selectedPrediction.prediction_id,
        corrected_value: {
          ...selectedPrediction,
          evidence_spans: [...selectedPrediction.evidence_spans]
        }
      };
    }

    const predictionFeedback = feedbackData[selectedPrediction.prediction_id];

    // If editing an existing span
    if (activeSpan) {
      if (isHtmlContent) {
        // For HTML content, we track the original XPath and relative positions
        const correctedSpans = predictionFeedback.corrected_value.evidence_spans;
        const existingCorrectionIndex = correctedSpans.findIndex(
          span => span.xpath === activeSpan.xpath && 
                  span.relative_start === activeSpan.relative_start && 
                  span.relative_end === activeSpan.relative_end
        );
        
        if (existingCorrectionIndex >= 0) {
          // Update existing correction
          correctedSpans[existingCorrectionIndex] = {
            ...correctedSpans[existingCorrectionIndex],
            ...highlightedText
          };
        } else {
          // Add a new correction that references the original span
          correctedSpans.push({
            ...highlightedText,
            id: `corrected-${Date.now()}`,
            original_xpath: activeSpan.xpath,
            original_relative_start: activeSpan.relative_start,
            original_relative_end: activeSpan.relative_end
          });
        }
      } else {
        // Plain text handling (backward compatibility)
        const correctedSpans = predictionFeedback.corrected_value.evidence_spans;
        const existingCorrectionIndex = correctedSpans.findIndex(
          span => span.start === activeSpan.start && span.end === activeSpan.end
        );
        
        if (existingCorrectionIndex >= 0) {
          // Update existing correction
          correctedSpans[existingCorrectionIndex] = {
            ...correctedSpans[existingCorrectionIndex],
            ...highlightedText
          };
        } else {
          // Add a new correction that references the original span
          correctedSpans.push({
            ...highlightedText,
            id: `corrected-${Date.now()}`,
            original_start: activeSpan.start,
            original_end: activeSpan.end
          });
        }
      }
    } else {
      // Adding a new span
      predictionFeedback.corrected_value.evidence_spans.push({
        ...highlightedText,
        id: `new-${Date.now()}`
      });
    }

    // Update state
    setFeedbackData({ ...feedbackData });
    setEditMode(false);
    setActiveSpan(null);
    setHighlightedText(null);
  };

  // Enter text selection mode to choose a new text
  const enterSelectionMode = () => {
    setSelectionMode(true);
  };
  
  // Exit text selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
  };

  // Cancel the current edit
  const cancelSpanEdit = () => {
    setEditMode(false);
    setHighlightedText(null);
    setSelectionMode(false);
  };

  // Submit feedback for all predictions
  const handleSubmitFeedback = () => {
    if (Object.keys(feedbackData).length === 0) return;
    
    onFeedbackSubmit(feedbackData);
    
    // Reset after submission
    setFeedbackData({});
    setSelectedPrediction(null);
    setActiveSpan(null);
    setEditMode(false);
  };

  // Make edit mode and panel control functions available to DOM event handlers
  useEffect(() => {
    window.editMode = editMode;
    
    // Define the function to open the edit panel
    window.openEditPanel = () => {
      // Debug log removed:  openEditPanel called');
      setEditPanelVisible(true);
    };
    
    // Cleanup function
    return () => {
      window.openEditPanel = undefined;
    };
  }, [editMode]);

  // editMode state is already shared in the useEffect above
  
  // Define the email body click handler with useCallback for stable reference
  const handleEmailBodyClick = useCallback((event) => {
    if (!event || !event.target) {
      // Debug error removed:  Invalid event object in click handler');
      return;
    }
    
    // Find if the click was on or within an evidence span
    let target = event.target;
    let spanElement = null;
    const currentEmailBody = emailBodyRef?.current;
    
    // Traverse up the DOM to find if we clicked on an evidence span
    try {
      while (target && target !== currentEmailBody) {
        if (target.classList && target.classList.contains('evidence-span')) {
          spanElement = target;
          break;
        }
        target = target.parentElement;
      }
    } catch (error) {
      // Debug error removed:  Error traversing DOM:', error);
      return;
    }
    
    // If we didn't click on a span, do nothing
    if (!spanElement) return;
    
    // Debug log removed:  Evidence span clicked:', spanElement);
    // Debug log removed:  Current edit mode:', editMode);
    
    // If not in edit mode or read-only, do nothing
    if (!editMode || readOnly) {
      // Debug log removed:  Edit disabled: editMode =', editMode, 'readOnly =', readOnly);
      return;
    }
    
    // Extract data from the span element safely
    let spanId, spanType, fieldName, text;
    try {
      spanId = spanElement.dataset?.spanId || '';
      spanType = spanElement.dataset?.spanType || '';
      fieldName = spanElement.dataset?.fieldName || '';
      text = spanElement.dataset?.spanText || spanElement.textContent || '';
    } catch (error) {
      // Debug error removed:  Error extracting data from span:', error);
      return;
    }
    
    // Debug log removed:  Processing span click:', { spanId, spanType, fieldName, text });
    
    if (!selectedPrediction) {
      // Debug log removed:  No prediction selected');
      return;
    }
    // Find the span either by id or by generated id (span-index)
    const originalSpan = selectedPrediction?.evidence_spans.find(span => {
      // Debug log removed:  Checking span:', span, 'against spanId:', spanId);
      if (span.id) {
        const match = span.id === spanId;
        // Debug log removed:  Match by ID:', match);
        return match;
      }
      // If spanId looks like 'span-X', try to match by index
      if (spanId && spanId.startsWith('span-')) {
        const index = parseInt(spanId.replace('span-', ''));
        const indexMatch = index !== undefined && index >= 0 && 
                  selectedPrediction.evidence_spans.indexOf(span) === index;
        // Debug log removed:  Match by index:', indexMatch, 'for index:', index);
        return indexMatch;
      }
      return false;
    });
    
    // Debug log removed:  Found original span:', originalSpan);
    
    if (originalSpan) {
      // Debug log removed:  Setting active span and highlighted text');
      setActiveSpan(originalSpan);
      setHighlightedText({
        ...originalSpan,
        text: text
      });
      
      // If we're in edit mode, open the edit panel
      if (editMode) {
        // Debug log removed:  Opening edit panel');
        // Use window as a global namespace for this critical function
        // This avoids dependency array issues
        if (typeof window.openEditPanel === 'function') {
          window.openEditPanel();
        } else {
          // Debug error removed:  openEditPanel function not available');
        }
      } else {
        // Debug log removed:  Not in edit mode, edit panel not opened');
      }
    } else {
      // Debug log removed:  No matching span found');
    }
  }, [editMode, readOnly, selectedPrediction, emailBodyRef]);
    
  // Set up event delegation for evidence span clicks
  useEffect(() => {
    // Safely get the email body element
    const emailBody = emailBodyRef?.current;
    
    // Only attach listener if element exists
    if (emailBody) {
      // Debug log removed:  Attaching click handler to email body');
      try {
        emailBody.addEventListener('click', handleEmailBodyClick);
      } catch (error) {
        // Debug error removed:  Error attaching click handler:', error);
      }
    }

    // Clean up event listener when component unmounts
    return () => {
      // Store reference to ensure it's available during cleanup
      const currentEmailBody = emailBodyRef?.current;
      
      if (currentEmailBody) {
        // Debug log removed:  Removing click handler from email body');
        try {
          currentEmailBody.removeEventListener('click', handleEmailBodyClick);
        } catch (error) {
          // Debug error removed:  Error removing click handler:', error);
        }
      }
    };
  }, [handleEmailBodyClick, emailBodyRef]);

  // Effect to apply highlights after HTML is rendered
  useEffect(() => {
    if (isHtmlContent && emailBodyRef.current && selectedPrediction) {
      try {
        // Create a proper HTML document structure to ensure correct XPath evaluation
        const parser = new DOMParser();
        const doc = parser.parseFromString(emailContent, 'text/html');
        
        // Check if doc is valid
        if (!doc || !doc.documentElement) {
          console.error('Failed to parse HTML content');
          return;
        }
        
        // Clear any existing content
        emailBodyRef.current.innerHTML = '';
        
        // Create a wrapper that matches the structure expected by XPath
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'email-html-wrapper';
        
        // Clone the body content from parsed document to preserve structure
        if (doc.body && doc.body.childNodes.length > 0) {
          Array.from(doc.body.childNodes).forEach(child => {
            wrapperDiv.appendChild(child.cloneNode(true));
          });
        } else {
          // Fallback - use the sanitized HTML directly
          wrapperDiv.innerHTML = sanitizedHtml;
        }
        
        // Add the wrapper to the DOM
        emailBodyRef.current.appendChild(wrapperDiv);
        
        // Make sure evidence_spans is defined before applying highlights
        const evidenceSpans = Array.isArray(selectedPrediction.evidence_spans) 
          ? selectedPrediction.evidence_spans 
          : [];
        
        // Use a small timeout to ensure DOM is fully rendered before applying highlights
        setTimeout(() => {
          applyHighlights(wrapperDiv, evidenceSpans);
        }, 50);
      } catch (error) {
        console.error('Error in HTML content processing:', error);
      }
    }
  }, [selectedPrediction, isHtmlContent, applyHighlights, emailContent]);

  // Effect to attach event listeners to highlighted spans after rendering
  useEffect(() => {
    // Only attach listeners if we have email content
    if (!emailBodyRef.current) return;
    
    // Get all evidence spans
    const spans = emailBodyRef.current.querySelectorAll('.evidence-span');
    
    // Track drag state for resize operations
    let isDragging = false;
    let activeHandle = null;
    let originalSpanData = null;
    
    // Helper function for resize handle drag start
    const handleDragStart = (e) => {
      if (!editMode) return;
      
      const handle = e.target;
      if (!handle.classList.contains('resize-handle')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      isDragging = true;
      activeHandle = handle;
      
      // Store original parent span information
      const parentSpan = handle.closest('.evidence-span');
      if (!parentSpan) return;
      
      const spanId = parentSpan.dataset.spanId;
      const spanType = parentSpan.dataset.spanType;
      const fieldName = parentSpan.dataset.fieldName;
      const spanText = parentSpan.dataset.spanText;
      
      originalSpanData = {
        spanElement: parentSpan,
        spanId,
        spanType,
        fieldName,
        spanText,
        initialX: e.clientX,
        textNode: Array.from(parentSpan.childNodes).find(node => node.nodeType === Node.TEXT_NODE)
      };
      
      // Add dragging class to document body
      document.body.classList.add('resizing-evidence');
    };
    
    // Helper function for resize handle drag
    const handleDrag = (e) => {
      if (!isDragging || !activeHandle || !originalSpanData) return;
      
      const handleType = activeHandle.dataset.handleType;
      const xDiff = e.clientX - originalSpanData.initialX;
      
      // Calculate character movement based on approximate character width
      // This is an approximation; a more accurate approach would use font metrics
      const approxCharWidth = 8; // pixels per character, adjust as needed
      const charDiff = Math.round(xDiff / approxCharWidth);
      
      // Clone original span data for modification
      const spanData = { ...originalSpanData };
      
      // Get the text content to work with
      const text = spanData.spanText;
      
      // Update text based on handle being dragged
      if (handleType === 'start') {
        // Moving start position
        const newStart = Math.max(0, Math.min(charDiff, text.length - 1));
        const newText = text.substring(newStart);
        
        if (originalSpanData.textNode) {
          originalSpanData.textNode.nodeValue = newText;
        }
        
        // Store updated position to be applied when drag ends
        spanData.newStartOffset = newStart;
      } else if (handleType === 'end') {
        // Moving end position
        const newEnd = Math.max(1, Math.min(text.length, text.length - charDiff));
        const newText = text.substring(0, newEnd);
        
        if (originalSpanData.textNode) {
          originalSpanData.textNode.nodeValue = newText;
        }
        
        // Store updated position to be applied when drag ends
        spanData.newEndOffset = newEnd;
      }
    };
    
    // Helper function for resize handle drag end
    const handleDragEnd = () => {
      if (!isDragging || !activeHandle || !originalSpanData) return;
      
      // Get the original span data from the selected prediction
      const originalSpan = selectedPrediction.evidence_spans.find(
        span => span.id === originalSpanData.spanId
      );
      
      if (originalSpan) {
        // Create updated span data based on the drag operation
        const updatedSpan = { ...originalSpan };
        const handleType = activeHandle.dataset.handleType;
        
        if (handleType === 'start' && originalSpanData.newStartOffset !== undefined) {
          // Update start position
          updatedSpan.relative_start += originalSpanData.newStartOffset;
          updatedSpan.text = originalSpanData.spanText.substring(originalSpanData.newStartOffset);
        } else if (handleType === 'end' && originalSpanData.newEndOffset !== undefined) {
          // Update end position
          updatedSpan.relative_end = updatedSpan.relative_start + originalSpanData.newEndOffset;
          updatedSpan.text = originalSpanData.spanText.substring(0, originalSpanData.newEndOffset);
        }
        
        // Update highlighted text with adjusted span
        setHighlightedText(updatedSpan);
        setEditPanelVisible(true);
      }
      
      // Reset drag state
      isDragging = false;
      activeHandle = null;
      originalSpanData = null;
      document.body.classList.remove('resizing-evidence');
    };
    
    // Add click handler to each span
    spans.forEach(span => {
      // For non-edit mode, add click handler
      if (!editMode && span.dataset.clickable === 'true') {
        span.addEventListener('click', (e) => {
          // Prevent any parent handlers from triggering
          e.stopPropagation();
          
          if (readOnly) return;
          
          // Get the span ID, type and field name
          const spanId = span.dataset.spanId;
          const spanType = span.dataset.spanType;
          const fieldName = span.dataset.fieldName;
          
          // Highlight corresponding element in prediction card
          highlightPredictionCardElement(spanType, fieldName);
          
          // Set the active span
          setActiveSpan(spanId);
        });
      }
      
      // For edit mode, add resize handle listeners
      if (editMode) {
        const handles = span.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
          handle.addEventListener('mousedown', handleDragStart);
        });
      }
    });
    
    // Add document-level listeners for drag operations
    if (editMode) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
    }
    
    // Cleanup function to remove event listeners
    return () => {
      if (!emailBodyRef.current) return;
      
      // Clean up span listeners
      const spans = emailBodyRef.current.querySelectorAll('.evidence-span');
      spans.forEach(span => {
        span.replaceWith(span.cloneNode(true));
      });
      
      // Clean up document listeners
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
      document.body.classList.remove('resizing-evidence');
    };
  }, [selectedPrediction, emailContent, editMode, readOnly, highlightPredictionCardElement]);

  // Render email body content
  const renderEmailContent = () => {
    if (!emailContent) return <p>No email content available</p>;
    
    if (isHtmlContent) {
      return (
        <div 
          ref={emailBodyRef}
          className={`email-body html-content ${editMode ? 'edit-mode' : ''}`}
          dangerouslySetInnerHTML={createSafeHtml(emailContent)}
          onMouseUp={editMode ? handleTextSelection : undefined}
        />
      );
    }
    
    // Fall back to plain text handling
    return renderPlainTextWithSpans();
  };
  
  // Original plain text handling (for backward compatibility)
  const renderPlainTextWithSpans = () => {
    let spans = [];
    if (selectedPrediction) {
      spans = selectedPrediction.evidence_spans || [];
    }
    
    // Sort spans by starting position
    const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
    
    let lastIndex = 0;
    const elements = [];
    
    // Iterate through spans and create highlighted sections
    sortedSpans.forEach((span, index) => {
      if (span.start > lastIndex) {
        // Add non-highlighted text before this span
        elements.push(
          <span key={`text-${lastIndex}`}>
            {emailContent.substring(lastIndex, span.start)}
          </span>
        );
      }
      
      // Check if this span has been modified in feedback
      let modifiedSpan = null;
      if (selectedPrediction && feedbackData[selectedPrediction.prediction_id]) {
        const correctedSpans = feedbackData[selectedPrediction.prediction_id].corrected_value.evidence_spans || [];
        modifiedSpan = correctedSpans.find(
          s => s.original_start === span.start && s.original_end === span.end
        );
      }
      
      // If span is modified, use the new span data
      const spanText = modifiedSpan ? modifiedSpan.new_text : emailContent.substring(span.start, span.end);
      const isActive = activeSpan && activeSpan.start === span.start && activeSpan.end === span.end;
      const spanType = span.type || 'default';
      
      // Add highlighted span
      elements.push(
        <span
          key={`span-${span.start}-${span.end}`}
          className={`highlight highlight-${spanType} ${isActive ? 'active' : ''} ${modifiedSpan ? 'modified' : ''}`}
          onClick={() => handleSpanClick(span)}
          title={`${spanType}${span.field ? ': ' + span.field : ''}`}
        >
          {spanText}
        </span>
      );
      
      lastIndex = span.end;
    });
    
    // Add remaining text after the last span
    if (lastIndex < emailContent.length) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {emailContent.substring(lastIndex)}
        </span>
      );
    }
    
    return (
      <div 
        ref={emailBodyRef} 
        className={`email-body ${editMode ? 'edit-mode' : ''}`}
        onMouseUp={editMode ? handleTextSelection : undefined}
      >
        {elements}
      </div>
    );
  };

  // Render edit controls for active span
  const renderEditControls = () => {
    if (!activeSpan || !editMode) return null;
    
    return (
      <div className="span-edit-controls">
        <h4>Edit Span</h4>
        <div className="edit-field">
          <label>Type:</label>
          <select
            value={highlightedText?.type || activeSpan.type || ''}
            onChange={(e) => handleSpanMetadataChange('type', e.target.value)}
          >
            <option value="intent">Intent</option>
            <option value="artefact_detail">Artefact Detail</option>
            <option value="action">Action</option>
          </select>
        </div>
        
        {(highlightedText?.type === 'artefact_detail' || activeSpan.type === 'artefact_detail') && (
          <div className="edit-field">
            <label>Field:</label>
            <select
              value={highlightedText?.field || activeSpan.field || ''}
              onChange={(e) => handleSpanMetadataChange('field', e.target.value)}
            >
              <option value="currency">Currency</option>
              <option value="amount">Amount</option>
              <option value="isin">ISIN</option>
              <option value="value_date">Value Date</option>
              <option value="reference">Reference</option>
              <option value="new_value_date">New Value Date</option>
            </select>
          </div>
        )}
        
        <div className="edit-field">
          <label>Text Selection:</label>
          <button 
            onClick={selectionMode ? exitSelectionMode : enterSelectionMode}
            className={`selection-btn ${selectionMode ? 'active' : ''}`}
          >
            {selectionMode ? 'Cancel Selection' : 'Select Different Text'}
          </button>
          {selectionMode && (
            <div className="selection-instructions">
              Select text in the email to use as evidence
            </div>
          )}
        </div>
        
        <div className="edit-actions">
          <button onClick={applySpanEdit} disabled={!highlightedText} className="apply-btn">
            Apply
          </button>
          <button onClick={cancelSpanEdit} className="cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    );
  };
  
  // Function to render prediction cards with data attributes for highlighting
  const renderPredictionCards = () => {
    // More robust check for predictions: ensure it exists, is an array, and has items
    const predictions = Array.isArray(apiResponse?.intent_parser_result?.predictions) 
      ? apiResponse.intent_parser_result.predictions 
      : [];
    
    if (predictions.length === 0) {
      return <p>No predictions available</p>;
    }

    return predictions.map(prediction => {
      const isSelected = selectedPrediction?.prediction_id === prediction.prediction_id;
      
      return (
        <div 
          key={prediction.prediction_id}
          className={`prediction-card prediction-card-intent ${isSelected ? 'selected' : ''}`}
          onClick={() => handlePredictionSelect(prediction)}
        >
          <div className="card-header">
            <h4>{prediction.intent}</h4>
          </div>
          <div className="card-content">
            <p data-field="action" className="highlight-action"><strong>Action:</strong> {prediction.action}</p>
            <p data-field="artefact" className="highlight-artefact_type"><strong>Artefact:</strong> {prediction.artefact?.type}</p>
            
            {/* Render artefact details if available */}
            {prediction.artefact?.details && (
              <div className="artefact-details">
                <p><strong>Details:</strong></p>
                <ul className="artefact-details-list">
                  {Object.entries(prediction.artefact.details).map(([key, value]) => (
                    <li key={key} data-field={key} className="highlight-artefact_detail"><strong>{key}:</strong> {value}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

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
          
          {renderEditControls()}
        </div>
      </div>
    </div>
  );
};

EmailIntentVisualizer.propTypes = {
  apiResponse: PropTypes.object.isRequired,
  onFeedbackSubmit: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  theme: PropTypes.oneOf(['light', 'dark'])
};

export default EmailIntentVisualizer;
