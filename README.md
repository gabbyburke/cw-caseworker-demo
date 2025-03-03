# GenAI for Child Welfare Caseworkers - Demo Version

**Based on Elevate 2025 CE Gen AI Competition**

* gabbyburke@
* rgoldenbroit@
* ravenhedden@
* rancho@
* stephenriley@

# Brief summary
This app demonstrates Gemini functionality for case workers in a child welfare context. It is configured for Firebase and includes 4 Cloud Run Functions that need to be deployed (or use the URLs provided). All 4 functions and their associated requirements are written in Python 3.11 and stored in /functions. The app itself is in /public.

# Deployment
1. **Deploy Cloud Run Functions** Using /functions, deploy individually. Generate a new Gemini API Key and store the key as a variable called GOOGLE_API_KEY when deploying the function.
2. **Clone repository or duplicate files locally** If you want to deploy from Github, authenticate within Firebase (make sure Firebase and all dependencies are deployed already). You will probably have to reauth every deployment which is annoying. Ensure all files are stored in a /public directory and are saved using Firebase preferred naming conventions (app.js, index.html, styles.css).
3. **Set up a new site in Firebase** If needed, navigate to Firebase and create a new site or run firebase init, then firebase login, then firebase hosting.sites.create "[sitename]"
4. **Deploy to Firebase** Once you are navigated to the correct directory and have verified that you are logged into the correct site, firebase deploy --only hosting
