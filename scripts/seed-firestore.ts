import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gymbro-app-1792210674",
  appId: "1:402299427215:web:10834ce85d0a5099e453fa",
  storageBucket: "gymbro-app-1792210674.firebasestorage.app",
  apiKey: "AIzaSyAcrjVg_vpV3XXZHGlXs1CoLX3VjqOhHO8",
  authDomain: "gymbro-app-1792210674.firebaseapp.com",
  messagingSenderId: "402299427215",
  projectNumber: "402299427215"
};

const defaultMoves = [
  { title: "Barbell Bench Press", description: "Compound chest movement targeting pectoralis major, anterior deltoids, and triceps.", type: "upper", category: "Chest" },
  { title: "Pull Up", description: "Bodyweight vertical pull movement targeting latissimus dorsi and biceps.", type: "upper", category: "Back" },
  { title: "Overhead Press", description: "Shoulder dominant pressing movement engaging deltoids, triceps, and upper traps.", type: "upper", category: "Shoulders" },
  { title: "Barbell Curl", description: "Isolation movement targeting biceps brachii and brachialis.", type: "upper", category: "Arms" },
  { title: "Tricep Pushdown", description: "Cable isolation for triceps brachii, all three heads.", type: "upper", category: "Arms" },
  { title: "Barbell Back Squat", description: "Fundamental lower body exercise for quadriceps, hamstrings, and core stability.", type: "lower", category: "Quadriceps" },
  { title: "Leg Press", description: "Machine-based quad dominant lower body push movement.", type: "lower", category: "Quadriceps" },
  { title: "Romanian Deadlift", description: "Hip hinge movement targeting hamstrings, glutes, and erector spinae.", type: "lower", category: "Hamstring" },
  { title: "Deadlift", description: "Full-body powerhouse movement engaging posterior chain, glutes, and lower back.", type: "lower", category: "Hamstring" },
  { title: "Hip Thrust", description: "Glute dominant movement with barbell load for maximum posterior activation.", type: "lower", category: "Glutes" },
  { title: "Standing Calf Raise", description: "Isolation movement targeting the gastrocnemius and soleus muscles.", type: "lower", category: "Calves" }
];

async function seed() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const movesRef = collection(db, "gym_moves");

  const existingSnap = await getDocs(movesRef);
  if (!existingSnap.empty) {
    console.log(`Database already has ${existingSnap.size} moves. Skipping seed.`);
    return;
  }

  console.log("Seeding default gym moves to Firestore...");
  for (const move of defaultMoves) {
    await addDoc(movesRef, {
      username: null,
      title: move.title,
      description: move.description,
      type: move.type,
      category: move.category,
      createdAt: serverTimestamp()
    });
    console.log(`✓ Added: ${move.title}`);
  }
  console.log("Default moves seeded successfully! ✓");
}

seed().catch(console.error);
