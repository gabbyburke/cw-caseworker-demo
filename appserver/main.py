from flask import Flask, request, Response, jsonify
from geminisupport import generate_response
from google.cloud import bigquery
import json
import os

bq = bigquery.Client()

app = Flask(__name__,
            static_url_path='', 
            static_folder='site',
            template_folder='')

@app.route("/casenotes/<case_id>")
def run_casenotes(case_id):

    if case_id.isnumeric():
        # Perform a query.
        query = (
            f"""
            select case_id, visit_id, visit_date, note from `ignite2025.case_notes.case_notes` as cn
            where cn.case_id={case_id}
            order by cn.visit_id desc
            """)
        query_job = bq.query(query)  # API request
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