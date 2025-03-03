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

# System instruction for transcript processing
SYSTEM_INSTRUCTION = '''
You are a transcript cleanup assistant. Your task is to:
1. Fix any obvious speech-to-text errors
2. Add proper punctuation and formatting
3. Break text into logical paragraphs
4. Maintain all factual information accurately
5. Keep the original meaning and tone
6. Make the text more readable while preserving all important details
'''

@functions_framework.http
def massage_transcript(request):
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
        if not request_json:
            return (jsonify({'error': 'Missing request body'}), 400, headers)

        raw_text = request_json if isinstance(request_json, str) else str(request_json)

        # Generate cleaned transcript using Gemini
        prompt = f"""Please fix this transcript to make it more readable while maintaining all the important information. Add proper punctuation, fix obvious spelling mistakes, and format it in a way that's easy to read:

{raw_text}

Please maintain all the key information while making it more professional and easier to read."""

        response = model.generate_content(
            contents=[SYSTEM_INSTRUCTION, prompt],
            generation_config={
                "temperature": 0.3,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 2048,
            }
        )

        return (jsonify({'fixed': response.text}), 200, headers)

    except Exception as e:
        return (jsonify({'error': str(e)}), 500, headers)
