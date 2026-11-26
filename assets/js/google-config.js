// Google Cloud Console: isi dua nilai ini sebelum fitur Drive digunakan.
const GOOGLE_CLIENT_ID = "546319902065-vdjks297sh3m65jr6jtvr8urdm6h6e8k.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyAz390I98uwgP8M54vh99xymZ9wYbNybTA";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_APP_ID = (() => {
    const prefix = (GOOGLE_CLIENT_ID || "").split("-")[0];
    return /^\d+$/.test(prefix) ? prefix : "";
})();
