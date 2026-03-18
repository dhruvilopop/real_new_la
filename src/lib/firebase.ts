import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  User as FirebaseUser,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential
} from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBK3su2PKeL3YnC9r63Fr50edqO1XUGjM0",
  authDomain: "loancustomerapp.firebaseapp.com",
  projectId: "loancustomerapp",
  storageBucket: "loancustomerapp.firebasestorage.app",
  messagingSenderId: "504278935777",
  appId: "1:504278935777:web:c0acba2fe42fc02451afa0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(result.user);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export const initRecaptcha = (buttonId: string) => {
  if (typeof window !== 'undefined') {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
      size: 'invisible',
      callback: () => {},
    });
  }
};

export const sendPhoneOTP = async (phoneNumber: string, buttonId: string) => {
  try {
    initRecaptcha(buttonId);
    const appVerifier = window.recaptchaVerifier!;
    const provider = new PhoneAuthProvider(auth);
    const verificationId = await provider.verifyPhoneNumber(phoneNumber, appVerifier);
    return { success: true, verificationId };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

export const verifyPhoneOTP = async (verificationId: string, otp: string) => {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, otp);
    const result = await signInWithCredential(auth, credential);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
};

export type { FirebaseUser };
