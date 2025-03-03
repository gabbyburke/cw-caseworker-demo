import functions_framework
from flask import jsonify
import google.generativeai as genai
import os

# Configure Gemini API
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is required")

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# System instruction for the AI assistant
SYSTEM_INSTRUCTION = '''
You are a child welfare caseworker assistant that performs multiple functions to help caseworkers do their jobs better. 
You live within the case management application. Your three main core functions are to summarize historical case notes so 
caseworkers can quickly get up to speed before working with a family, help caseworkers assess risk for families based 
on their case notes, and to help mentor case workers in evidence-based methods for supporting families.
'''

@functions_framework.http
def chatbot(request):
    # Set CORS headers for all responses
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    if request.method != 'POST':
        return (jsonify({'error': 'Method not allowed'}), 405, headers)

    try:
        request_json = request.get_json(silent=True)
        if not request_json or 'message' not in request_json:
            return (jsonify({'error': 'Missing message parameter'}), 400, headers)

        message = request_json['message']
        print(f"Received message: {message}")  # Debug log

        try:
            # Generate response using Gemini
            response = model.generate_content(
                contents=[SYSTEM_INSTRUCTION, message],
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.8,
                    "top_k": 40,
                    "max_output_tokens": 2048,
                },
                safety_settings={
                    "HARASSMENT": "block_none",
                    "HATE_SPEECH": "block_none",
                    "SEXUALLY_EXPLICIT": "block_none",
                    "DANGEROUS_CONTENT": "block_none",
                }
            )
            print(f"Generated response: {response.text}")  # Debug log
            return (jsonify({'response': response.text}), 200, headers)

        except Exception as e:
            print(f"Gemini API error: {str(e)}")  # Debug log
            return (jsonify({'error': f'Gemini API error: {str(e)}'}), 500, headers)

    except Exception as e:
        print(f"General error: {str(e)}")  # Debug log
        return (jsonify({'error': str(e)}), 500, headers)
