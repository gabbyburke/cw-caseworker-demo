from firebase_functions import https_fn, options
from firebase_admin import initialize_app
from flask import Flask, request, Response, jsonify, redirect
from geminisupport import generate_response, summarize, fix_transcript
from google.cloud import bigquery
import json
import os
import time

initialize_app()

UNIQUE_CASE_NOTES_QUERY = """
    select
        agg.table.*
    from (
        select
            case_id, visit_id,
            ARRAY_AGG(STRUCT(table)
            order by
            version desc)[SAFE_OFFSET(0)] agg
        from
            `gb-demos.cw_case_notes.cw_case_notes` table
        where case_id={}
        group by
            case_id, visit_id
    )
    order by visit_id desc
"""

bq = bigquery.Client()

app = Flask(__name__)

@https_fn.on_request(
    cors=options.CorsOptions(
        cors_origins=["*"],
        cors_methods=["GET", "POST", "OPTIONS"]
    )
)
def caseworker_api(req: https_fn.Request) -> https_fn.Response:
    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response('', status=204, headers=headers)
    
    # Set CORS headers for the main request
    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    # Handle /gemini endpoint
    if req.path.endswith('/gemini'):
        if req.method == 'POST':
            data = req.get_json()
            message = data.get('message')
            if not message:
                return https_fn.Response('Missing message parameter', status=400, headers=headers)
            response = generate_response(message)
            return https_fn.Response(json.dumps({'response': response}), mimetype='application/json', headers=headers)
    
    # Handle /casenotes endpoint
    elif '/casenotes/' in req.path:
        path_parts = req.path.split('/')
        if len(path_parts) < 3:
            return https_fn.Response('Invalid path', status=400, headers=headers)
        
        case_id = path_parts[2]
        
        if req.method == 'GET':
            query = UNIQUE_CASE_NOTES_QUERY.format(case_id)
            query_job = bq.query(query)
            results = query_job.result()
            
            rows = []
            for row in results:
                rows.append(row.agg)
                
            return https_fn.Response(json.dumps(rows), mimetype='application/json', headers=headers)
            
        elif req.method == 'POST':
            data = req.get_json()
            if not data:
                return https_fn.Response('Missing request body', status=400, headers=headers)
                
            # Insert into BigQuery
            table_id = 'gb-demos.cw_case_notes.cw_case_notes'
            errors = bq.insert_rows_json(table_id, [data])
            
            if errors:
                return https_fn.Response(f'Error inserting rows: {errors}', status=500, headers=headers)
            return https_fn.Response(json.dumps({'status': 'success'}), mimetype='application/json', headers=headers)
    
    # Handle /genai_auto_summarize endpoint
    elif '/genai_auto_summarize/' in req.path:
        path_parts = req.path.split('/')
        if len(path_parts) < 4:
            return https_fn.Response('Invalid path', status=400, headers=headers)
            
        case_id = path_parts[2]
        visit_id = path_parts[3]
        
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
            return https_fn.Response('Note not found', status=404, headers=headers)
            
        note = rows[0].note
        summary = summarize(note)
        
        # Update the note with the summary
        update_query = f"""
            UPDATE `gb-demos.cw_case_notes.cw_case_notes`
            SET genai_summary = '{summary}'
            WHERE case_id = {case_id} AND visit_id = {visit_id}
        """
        update_job = bq.query(update_query)
        update_job.result()
        
        return https_fn.Response(json.dumps({'summary': summary}), mimetype='application/json', headers=headers)
    
    # Handle /massage_transcript endpoint
    elif req.path.endswith('/massage_transcript'):
        if req.method == 'POST':
            data = req.get_json()
            if not isinstance(data, str):
                return https_fn.Response('Invalid request body', status=400, headers=headers)
                
            fixed = fix_transcript(data)
            return https_fn.Response(json.dumps({'fixed': fixed}), mimetype='application/json', headers=headers)
    
    return https_fn.Response('Not found', status=404, headers=headers)
