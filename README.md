# GenAI for Caseworkers

**Ignite 2025 GenAI Demo**

* gabbyburke@
* rgoldenbroit@
* ravenhedden@
* rancho@
* stephenriley@

# Brief summary

Under `appserver/` is a Cloud Run-hosted web app that serves the UI and hosts backend API calls to do such things as talk to Gemini and manage case notes.

# Running locally

1. **Authenticate to your Argolis account.** Type `gcloud auth application-default login`.  If the browser window pops up in a Chrome profile that is *not* Argolis, copy the URL from the command line and paste it into an Argolis browser window.
1. **Set the project that will host the Cloud Run-deployed appserver.** Type `gcloud config set project <PROJECT NAME>`.
1. **Install dependencies (do every time you add a dependency).**  Type `pip install -r requirements.txt`.
1. **Run it.** Type `python main.py`.

# Deployment

1. **TBD: set up Cloud Run**
1. From the `appserver/` directory, type `gcloud run deploy cw-ignite2025 --region us-central1 --source .`. (Note the period at the end--that's important.)

# TODO

- [X] Build out Cloud Run instance.
- [X] Write up how to create Cloud Run instance from command line.
- [X] Build out BigQuery data set and table with seed data.
- [ ] ~~Write up BQ creating and seeding.~~
- [ ] ~~Build out Pub/Sub connecting BQ writes to API.~~
- [X] Add API to summarize a single case note.
- [X] Add animation for reloading cases
- [ ] Add a Gemini animation next to "Save Note" while autosummarizing.
- [ ] ~~Add a table for cases, join to case_notes.  Add case_id, primary_caregiver, children (as string, total hack), case_type, risk_level, summary~~
- [ ] Implement search?
- [ ] Audio transcription?
- [ ] Talk with Gemini?
- [ ] Fix warning on enter key in chat space
- [ ] Add keyboard shortcuts

# DEMO TODO

- [ ] Switch everything to 67196
- [ ] Changing hardcoding to that
- [ ] Adjust names in scripts/records to match
- [ ] Write up architecture

