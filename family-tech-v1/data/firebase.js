// Firebase configuration for Family Tech
// يستخدم الموقع Firestore لحفظ المهام والنقاط بشكل مشترك بين جميع الأجهزة.
const firebaseConfig = {
  apiKey: "AIzaSyB6zzcIZfRGCoBKclvCGK5d11tkgBtdkt0",
  authDomain: "family-tech-ab478.firebaseapp.com",
  projectId: "family-tech-ab478",
  storageBucket: "family-tech-ab478.firebasestorage.app",
  messagingSenderId: "1071149537760",
  appId: "1:1071149537760:web:59440ce4764d79056f7385",
  measurementId: "G-T0WPN822KG"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
