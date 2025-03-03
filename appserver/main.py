from flask import Flask, request, Response, jsonify, redirect
from geminisupport import generate_response, summarize, fix_transcript
from google.cloud import bigquery
import json
import os
import time

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
            `ignite2025.case_notes.case_notes` table
        where case_id={}
        group by
            case_id, visit_id
    )
    order by visit_id desc
"""

bq = bigquery.Client()

app = Flask(__name__,
            static_url_path='', 
            static_folder='site',
            template_folder='')

@app.route("/", methods=['GET'])
def default_route():
    return redirect('/index.html')

@app.route("/massage_transcript", methods=['POST'])
def massage_transcript():
    fixed = fix_transcript(request.get_json())
    results = json.dumps({'fixed': fixed})

    return Response(results, mimetype='application/json')

@app.route("/genai_auto_summarize/<case_id>/<visit_id>", methods=['GET', 'PUT', 'POST'])
def auto_summarize_case_notes(case_id, visit_id):
    query = f"""
        select * from `ignite2025.case_notes.case_notes`
        where case_id={case_id} and visit_id={visit_id}
        order by version desc
        limit 1
    """
    query_job = bq.query(query)  # API request
    rows = query_job.result()  # will be 0 or 1 rows
    if rows.total_rows == 0:
        return Response('{}', mimetype='application/json')
    
    row = next(rows)

    if row['genai_summary'] != None or row['note_type'] == 'genai':
        return Response('{}', mimetype='application/json')
    
    data = dict(row)
    summary = summarize(data['note'])
    data['genai_summary'] = summary
    data['version'] = round(time.time() * 1000)
    data = json.loads(json.dumps(data, default=str))
    table = bq.get_table("ignite2025.case_notes.case_notes")
    errors = bq.insert_rows_json(table, [data])
    results = json.dumps({'case_id': data['case_id'], 'visit_id': data['visit_id'], 'version': data['version'], 'genai_summary': data['genai_summary']})

    return Response(results, mimetype='application/json')    

@app.route("/casenotes/<case_id>/<visit_id>", methods=['PUT', 'POST'])
def insert_casenotes(case_id, visit_id):
    request_json = request.get_json(silent=True)
    request_json['version'] = round(time.time() * 1000)
    rows = [request_json]
    table = bq.get_table("ignite2025.case_notes.case_notes")
    errors = bq.insert_rows_json(table, rows)
    if errors == []:
        return "success", 200

@app.route("/casenotes/<case_id>")
def get_casenotes(case_id):
    if case_id.isnumeric():
        # Perform a query.
        query_job = bq.query(UNIQUE_CASE_NOTES_QUERY.format(case_id))  # API request
        rows = query_job.result()  # Waits for query to finish

        # result = [ {'case_id': r.case_id, 'visit_id': r.visit_id, 'visit_date': r.visit_date, 'note': r.note} for r in rows]
        result = [dict(row) for row in rows]
        result = json.dumps(result, default=str)
        return Response(result, mimetype='application/json')
    else:
        return "Invalid case_id", 400

@app.route("/gemini", methods=['POST'])
def run_gemini():
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
        response_text = generate_response(user_message, chat_history)
        # return jsonify({'response': response}), 200, headers
        return Response(json.dumps({'response': response_text}), mimetype='application/json')
    except Exception as e:
        return Response(jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), mimetype='application/pdf')

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))