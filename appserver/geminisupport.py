from flask import jsonify
from google import genai
from google.genai import types

SYSINSTR_BODY = \
    'You are a child welfare caseworker assistant that performs multiple functions to help caseworkers do their jobs more efficiently. ' \
    'You live within the case management application. Your three main core functions are to summarize historical case notes so ' \
    'caseworkers can quickly get up to speed before working with a family, help caseworkers assess risk for their clients based ' \
    'on their case notes, and to help mentor case workers in evidence-based methods for supporting families and children dealing ' \
    'with cases of abuse and neglect. You are empathetic, conversational and professional, and you should keep in mind the difficulty '\
    'and sensitivity of the caseworker\'s job. When you summarize case notes, initially provide a very short 2-3 sentence summary ' \
    'highlighting key risks and next steps or actions needed. Provide more detail only when the case worker asks for it. When you ' \
    'provide mentorship, you should allow the caseworker to ask for fictional practice scenarios where you act as the client and give '\
    'empathetic, evidence-based feedback on their responses.\n'

SYSINSTR_TERSE = \
    'Please keep your answers very concise as if you were giving a one sentence precis. ' \
    'Do not conclude \n'

SYSINSTR_STRUCTURE = \
    'Before the user\'s question, you will get all the case notes for this particular client.  Each note will begin with "NOTE:". ' \
    'Please take these notes into account when you answer the user\'s question. ' \
    'The user\'s question will begin with "PROMPT:". ' \
    'Do not conclude your answers with any questions to the user such as "Would you like more details?"'

SYSINSTR_SUMMARIZE = \
    'With all of that in mind, please summarize these case notes. ' \
    'Do not include any polite leading sentence like "Okay, here is a short summary..." '

SYSTEM_INSTRUCTION = SYSINSTR_BODY + SYSINSTR_STRUCTURE

SYSINSTR_SUMMMARY_INSTRUCTION = SYSINSTR_BODY + SYSINSTR_TERSE + SYSINSTR_SUMMARIZE

TRANSCRIPT_INSTRUCTION = \
    'The text starting at "TEXT:" was transcribed from an audio source and represents the literal words spoken. ' \
    'Please interpret as literally as possible, using the words in the transcription--just turn it into proper sentences. ' \
    'ONLY respond with your interpretation and nothing else.'

# Initialize Vertex AI with GenAI - moved inside function to prevent cold start issues
def initialize_client():
    return genai.Client(
        vertexai=True,
        project="ignite2025",
        location="us-central1"
    )

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
            model="gemini-1.5-flash",
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
    
def summarize(note):
    """Generate a response using the GenAI model."""
    try:
        # Initialize client for each request
        client = initialize_client()

        contents = []
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(note)]
        ))

        # Generate response using Gemini 2.0
        response = client.models.generate_content(
            model="gemini-1.5-flash",
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
                system_instruction=[types.Part.from_text(SYSINSTR_SUMMMARY_INSTRUCTION)]
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

def fix_transcript(text):
    if(text == ''):
        return ''
    
    try:
    # Initialize client for each request
        client = initialize_client()

        contents = []
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text)]
        ))

        # Generate response using Gemini 2.0
        response = client.models.generate_content(
            model="gemini-1.5-flash",
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
                system_instruction=[types.Part.from_text(TRANSCRIPT_INSTRUCTION)]
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