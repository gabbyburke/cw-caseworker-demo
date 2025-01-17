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
1. From the `appserver/` directory, type `gcloud run deploy <NAME OF CLOUD RUN INSTANCE> --source .`. (Note the period at the end--that's important.)

# TODO
- [ ] Write up how to create Cloud Run instance from command line.