
```
export PROJECT_ID=ignite2025
export PROJECT_NUMBER=$(gcloud projects list \
    --filter="$(gcloud config get-value project)" \
    --format="value(PROJECT_NUMBER)")
```

```
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com
```

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
    --role=roles/cloudbuild.builds.builder
```

### Set up APIs and IAM for Cloud Run

```
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com
```

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
    --role=roles/run.builder
```

### Deploy server

```
cd appserver ; \
gcloud run deploy cw-ignite2025 --region us-central1 --source . ; \
cd ..
```

### Pub/Sub

```
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NO}-compute@developer.gserviceaccount.com"\
    --role='roles/iam.serviceAccountTokenCreator'

gcloud projects add-iam-policy-binding $PROJECT \
    --member=serviceAccount:${SVC_ACCOUNT} \
    --role='roles/eventarc.admin'
```