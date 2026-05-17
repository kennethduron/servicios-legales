const firebaseConfig = {
    apiKey: "AIzaSyDJBB0P8y_Z3IKcLSY2YPgf2-mukmrw9l8",
    authDomain: "sariahrivera.firebaseapp.com",
    projectId: "sariahrivera",
    storageBucket: "sariahrivera.firebasestorage.app",
    messagingSenderId: "151301323250",
    appId: "1:151301323250:web:8d764e773e2e864fb8936b"
};

if (window.firebase && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.firebaseServices = window.firebase ? {
    app: firebase.app(),
    db: firebase.firestore(),
    auth: firebase.auth()
} : null;
