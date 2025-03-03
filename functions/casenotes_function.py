from flask import Flask, Request, jsonify
from google.cloud import bigquery
import functions_framework

# Initialize BigQuery client
bq = bigquery.Client()

UNIQUE_CASE_NOTES_QUERY = """
    SELECT
        case_id,
        visit_id,
        note,
        note_type,
        visit_date,
        genai_summary,
        version
    FROM `gb-demos.cw_case_notes.cw_case_notes`
    WHERE case_id = {}
    ORDER BY visit_id DESC
"""

@functions_framework.http
def casenotes(request: Request):
    # Set CORS headers for all responses
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    try:
        # Extract case_id from path
        path_parts = request.path.split('/')
        if len(path_parts) < 2:
            return (jsonify({'error': 'Invalid path'}), 400, headers)
        
        case_id = path_parts[1]  # Skip first empty part from leading slash

        if request.method == 'GET':
            # Fetch case notes
            query = UNIQUE_CASE_NOTES_QUERY.format(case_id)
            query_job = bq.query(query)
            results = query_job.result()
            
            rows = []
            for row in results:
                # Convert BigQuery row to dict
                note_data = {
                    'case_id': row.case_id,
                    'visit_id': row.visit_id,
                    'note': row.note,
                    'note_type': row.note_type,
                    'visit_date': row.visit_date.strftime('%Y-%m-%d') if row.visit_date else None,
                    'genai_summary': None if row.genai_summary == 'null' else row.genai_summary,
                    'version': row.version
                }
                rows.append(note_data)
                
            return (jsonify(rows), 200, headers)
            
        elif request.method == 'POST':
            # Save new case note
            data = request.get_json()
            if not data:
                return (jsonify({'error': 'Missing request body'}), 400, headers)
            
            # Insert into BigQuery
            table_id = 'gb-demos.cw_case_notes.cw_case_notes'
            errors = bq.insert_rows_json(table_id, [data])
            
            if errors:
                return (jsonify({'error': f'Error inserting rows: {errors}'}), 500, headers)
            
            return (jsonify({'status': 'success'}), 200, headers)

    except Exception as e:
        return (jsonify({'error': str(e)}), 500, headers)

    return (jsonify({'error': 'Invalid method'}), 405, headers)
