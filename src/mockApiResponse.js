export const mockApiResponse = {
  "request_id": "9e5b5af6-abb0-4f51-bf3e-3ec43c6b3f88",
  "email": {
    "header": {
      "from": {
        "email": "example@example.com",
        "name": "John Doe"
      },
      "to": [
        {
          "email": "example@example.com",
          "name": "John Doe"
        }
      ],
      "subject": "Failed Trades and Amends",
      "received": "2025-07-01T11:35:47",
      "message_id": "DHJKDHKWJW68747692FHS"
    },
    "body": {
      "content": "Hello Team, please provide an update on the following pending trade for USD 1000 with ISIN bafd3415. Blah blah blah, and please also amend the below to match the broker's view with new value date 2025-06-06.",
      "document_type": "text"
    }
  },
  "intent_parser_result": {
    "model_info": {
      "name": "intent_parser",
      "version": "1.0.5"
    },
    "predictions": [
      {
        "prediction_id": "4d7f2a23-e3bd-44cb-8d35-b1c1dc4fae91",
        "intent": "request_update",
        "sender": "John Doe",
        "action": "provide_status",
        "artefact": {
          "type": "trade",
          "details": {
            "currency": "USD",
            "amount": "1000",
            "isin": "bafd3415"
          }
        },
        "time_of_action": "future",
        "evidence_spans": [
          {
            "type": "intent",
            "source": "email_body",
            "start": 13,
            "end": 39,
            "text": "please provide an update"
          },
          {
            "type": "artefact_detail",
            "field": "currency",
            "source": "email_body",
            "start": 70,
            "end": 73,
            "text": "USD"
          },
          {
            "type": "artefact_detail",
            "field": "amount",
            "source": "email_body",
            "start": 74,
            "end": 78,
            "text": "1000"
          },
          {
            "type": "artefact_detail",
            "field": "isin",
            "source": "email_body",
            "start": 88,
            "end": 96,
            "text": "bafd3415"
          }
        ]
      },
      {
        "prediction_id": "7a9d0d55-b25e-4312-bc65-8c07e44f3f92",
        "intent": "request_amendment",
        "sender": "John Doe",
        "action": "amend_value_date",
        "artefact": {
          "type": "trade",
          "details": {
            "currency": "USD",
            "amount": "1000",
            "isin": "bafd3415"
          }
        },
        "related_artefact": {
          "new_value_date": "2025-06-06"
        },
        "time_of_action": "future",
        "evidence_spans": [
          {
            "type": "intent",
            "source": "email_body",
            "start": 112,
            "end": 140,
            "text": "please also amend the below"
          },
          {
            "type": "artefact_detail",
            "field": "new_value_date",
            "source": "email_body",
            "start": 174,
            "end": 184,
            "text": "2025-06-06"
          }
        ]
      }
    ]
  }
};

// Adding another example with different intent/actions for testing
export const additionalMockResponse = {
  "request_id": "7d4e2c18-5fb9-4e23-a841-9c32e7d52f11",
  "email": {
    "header": {
      "from": {
        "email": "jane.smith@example.com",
        "name": "Jane Smith"
      },
      "to": [
        {
          "email": "support@example.com",
          "name": "Support Team"
        }
      ],
      "subject": "Urgent: Trade Cancellation Request",
      "received": "2025-07-03T09:22:15",
      "message_id": "LKJHGF654321POIUYT"
    },
    "body": {
      "content": "Dear Support, I need to cancel the pending trade with reference TRX123456 for EUR 5000 due to pricing discrepancies. The trade was executed yesterday with value date 2025-07-10. Please confirm cancellation by end of day.",
      "document_type": "text"
    }
  },
  "intent_parser_result": {
    "model_info": {
      "name": "intent_parser",
      "version": "1.0.5"
    },
    "predictions": [
      {
        "prediction_id": "3c5d9f12-7e8b-4a23-95c7-b1d2e3f4a5b6",
        "intent": "request_cancellation",
        "sender": "Jane Smith",
        "action": "cancel_trade",
        "artefact": {
          "type": "trade",
          "details": {
            "reference": "TRX123456",
            "currency": "EUR",
            "amount": "5000",
            "value_date": "2025-07-10"
          }
        },
        "time_of_action": "immediate",
        "evidence_spans": [
          {
            "type": "intent",
            "source": "email_body",
            "start": 13,
            "end": 39,
            "text": "I need to cancel the pending trade"
          },
          {
            "type": "artefact_detail",
            "field": "reference",
            "source": "email_body",
            "start": 50,
            "end": 59,
            "text": "TRX123456"
          },
          {
            "type": "artefact_detail",
            "field": "currency",
            "source": "email_body",
            "start": 64,
            "end": 67,
            "text": "EUR"
          },
          {
            "type": "artefact_detail",
            "field": "amount",
            "source": "email_body",
            "start": 68,
            "end": 72,
            "text": "5000"
          },
          {
            "type": "artefact_detail",
            "field": "value_date",
            "source": "email_body",
            "start": 122,
            "end": 132,
            "text": "2025-07-10"
          }
        ]
      }
    ]
  }
};
