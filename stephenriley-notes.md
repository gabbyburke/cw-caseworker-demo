
```
export PROJECT_ID=ignite2025
export PROJECT_NUMBER=357235907694
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