import functions_framework
from flask import Request, jsonify
import json
from google import genai
from google.genai import types
from google.cloud import bigquery
import os

# Configure Vertex AI
def initialize_client():
    return genai.Client(
        vertexai=True,
        project="gb-demos",
        location="us-central1"
    )
# Initialize BigQuery client
bq = bigquery.Client()

# System instruction for summarization
SYSTEM_INSTRUCTION = '''
You are a child welfare case note summarization assistant. Your task is to:
1. Analyze the case note and extract the key information
2. Create a clear, concise summary that highlights:
   - Main points and observations
   - Any identified risks or concerns
   - Important actions taken or planned
   - Significant changes in the family's situation
3. Format the summary in a professional, easy-to-scan way
4. Maintain all factual information accurately
5. Keep the tone objective and professional
'''

@functions_framework.http
def summarize(request: Request):
    # Set CORS headers for all responses
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    if request.method != 'GET':
        return (jsonify({'error': 'Method not allowed'}), 405, headers)

    try:
        # Extract case_id and visit_id from path
        path_parts = request.path.split('/')
        if len(path_parts) < 3:
            return (jsonify({'error': 'Invalid path'}), 400, headers)
        
        case_id = path_parts[1]
        visit_id = path_parts[2]

        # Get the note from BigQuery
        query = f"""
            SELECT note FROM `gb-demos.cw_case_notes.cw_case_notes`
            WHERE case_id = {case_id} AND visit_id = {visit_id}
            ORDER BY version DESC LIMIT 1
        """
        query_job = bq.query(query)
        results = query_job.result()
        rows = list(results)
        
        if not rows:
            return (jsonify({'error': 'Note not found'}), 404, headers)
            
        note = rows[0].note

        # Generate summary using Gemini
        prompt = f"""Please summarize the following case note in a clear and concise way that helps quickly understand the key points and any potential risks or concerns:

{note}

Please format your response in a way that's easy to scan and understand."""

        response = model.generate_content(
            contents=[SYSTEM_INSTRUCTION, prompt],
            generation_config={
                "temperature": 0.3,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 2048,
            }
        )

        summary = response.text

        # Update the note with the summary
        update_query = f"""
            UPDATE `gb-demos.cw_case_notes.cw_case_notes`
            SET genai_summary = '{summary}'
            WHERE case_id = {case_id} AND visit_id = {visit_id}
        """
        update_job = bq.query(update_query)
        update_job.result()
        
        return (jsonify({'summary': summary}), 200, headers)

    except Exception as e:
        return (jsonify({'error': str(e)}), 500, headers)
