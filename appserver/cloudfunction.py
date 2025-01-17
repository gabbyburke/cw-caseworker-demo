import functions_framework
from flask import jsonify
import json
from google import genai
from google.genai import types

# Initialize Vertex AI with GenAI - moved inside function to prevent cold start issues
def initialize_client():
    return genai.Client(
        vertexai=True,
        project="gb-demos",
        location="us-central1"
    )

# System instruction for the child welfare assistant
SYSTEM_INSTRUCTION = """You are a child welfare caseworker assistant that performs multiple functions to help caseworkers do their jobs more efficiently. You live within the case management application. Your three main core functions are to summarize historical case notes so caseworkers can quickly get up to speed before working with a family, help caseworkers assess risk for their clients based on their case notes, and to help mentor case workers in evidence-based methods for supporting families and children dealing with cases of abuse and neglect. You are empathetic, conversational and professional, and you should keep in mind the difficulty and sensitivity of the caseworker's job. When you summarize case notes, initially provide a very short 2-3 sentence summary highlighting key risks and next steps or actions needed. Provide more detail only when the case worker asks for it. When you provide mentorship, you should allow the caseworker to ask for fictional practice scenarios where you act as the client and give empathetic, evidence-based feedback on their responses."""

@functions_framework.http
def chatbot_function(request):
    """HTTP Cloud Function to handle chatbot requests."""
    # Handle health check requests
    if getattr(request, 'path', '') in ['/_ah/warmup', '/health']:
        return jsonify({"status": "healthy"}), 200

    # Set CORS headers for the preflight request
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    # Set CORS headers for the main request
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    try:
        # Get the request JSON
        request_json = request.get_json(silent=True)

        # Validate request format
        if not request_json:
            return jsonify({'error': 'Request must include JSON body'}), 400, headers
        if 'message' not in request_json:
            return jsonify({'error': 'Request must include message field'}), 400, headers

        # Extract message and optional chat history
        user_message = request_json['message']
        chat_history = request_json.get('history', [])

        # Generate response
        response = generate_response(user_message, chat_history)
        return jsonify({'response': response}), 200, headers

    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500, headers

def format_chat_history(history):
    """Convert chat history into GenAI content format."""
    contents = []
    
    # Add system instruction as the first content
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_text(SYSTEM_INSTRUCTION)]
    ))
    
    # Add chat history
    for msg in history:
        role = "model" if msg['sender'] == 'bot' else "user"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(msg['message'])]
        ))
    
    return contents

def generate_response(user_message, chat_history):
    """Generate a response using the GenAI model."""
    try:
        # Initialize client for each request
        client = initialize_client()

        # Format conversation history
        contents = format_chat_history(chat_history)
        
        # Add the current user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(user_message)]
        ))

        # Generate response using Gemini 2.0
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=1,
                top_p=0.95,
                max_output_tokens=8192,
                response_modalities=["TEXT"],
                safety_settings=[
                    types.SafetySetting(
                        category="HARM_CATEGORY_HATE_SPEECH",
                        threshold="OFF"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold="OFF"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold="OFF"
                    ),
                    types.SafetySetting(
                        category="HARM_CATEGORY_HARASSMENT",
                        threshold="OFF"
                    )
                ],
                system_instruction=[types.Part.from_text(SYSTEM_INSTRUCTION)]
            )
        )

        # Collect response
        full_response = ""
        if hasattr(response, 'text'):
            full_response = response.text
        else:
            for chunk in response:
                if chunk.text:
                    full_response += chunk.text

        return full_response.strip()

    except Exception as e:
        raise Exception(f"Failed to generate response: {str(e)}")
