// Firebase configuration — Portal de Itaboraí
// Projeto Firebase: hermanos-90985

export const firebaseConfig = {
  apiKey: "AIzaSyDkx-pRSL2bpYDxHPzGxS7I5JP7E9D7DZk",
  authDomain: "hermanos-90985.firebaseapp.com",
  projectId: "hermanos-90985",
  storageBucket: "hermanos-90985.firebasestorage.app",
  messagingSenderId: "306235657486",
  appId: "1:306235657486:web:531c91d953e09de8c29b5f",
};

export const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};
